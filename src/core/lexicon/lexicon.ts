/**
 * Step lexicon: one row per spoken phrase (keyword + token sequence).
 * Not a matcher. Display keeps `{slots}`; it does not insert sample values.
 */

import { MAX_ORPHAN_BINDING_SCAN } from '../domain/constants';
import type { Binding, FeatureStep, ResolvedKeyword, ResolveResult } from '../domain/types';
import { SUITE_MAP_LIST_CAP } from '../map/suiteMap';
import { sameBinding } from '../references/bindingIdentity';
import { patternTokenSequence } from '../reuse/suggestReuse';

const ANONYMOUS_GROUP = /\((?:[^()\\]|\\.)*\)/g;
const DIALECT_CAP = 3;

export interface LexiconPhrase {
    readonly phrase: string;
    readonly legible: boolean;
}

export interface LexiconImplementation {
    readonly signature: string;
    readonly methodName: string;
    readonly patternRaw: string;
    readonly path: string;
    readonly uri: Binding['uri'];
    readonly line: number;
    /** Bound steps that selected this implementation. Absent when the scan was skipped. */
    readonly speakerCount?: number;
}

export interface LexiconSpeaker {
    readonly uri: FeatureStep['uri'];
    readonly lineNumber: number;
    readonly text: string;
    readonly path: string;
}

export interface LexiconDialect {
    readonly key: string;
    readonly phrase: string;
}

export interface LexiconRow {
    readonly key: string;
    readonly keyword: ResolvedKeyword;
    readonly phrase: string;
    readonly implementations: readonly LexiconImplementation[];
    /** Absent when the usage scan was skipped. Empty means scanned and unused. */
    readonly speakers?: readonly LexiconSpeaker[];
    /** Absent when the dialect scan was skipped. */
    readonly dialects?: readonly LexiconDialect[];
}

export interface LexiconCounts {
    readonly words: number;
    readonly usages: number;
    readonly unused: number;
    readonly multi: number;
}

export interface LexiconUsageLocation {
    readonly uri: FeatureStep['uri'];
    readonly lineNumber: number;
    readonly key: string;
    readonly count: number;
}

export interface Lexicon {
    readonly rows: readonly LexiconRow[];
    readonly counts: LexiconCounts;
    readonly truncated: number;
    readonly usagesSkipped: boolean;
    readonly dialectsSkipped: boolean;
    /** Every bound call site, including words past the list cap. Absent when the scan was skipped. */
    readonly usageLocations?: readonly LexiconUsageLocation[];
}

export type ResolveStep = (step: FeatureStep) => ResolveResult;

export interface BuildLexiconOptions {
    readonly listCap?: number;
    readonly scanMax?: number;
}

/**
 * Visible phrase for a binding pattern. Placeholders stay as written.
 * An anonymous `(...)` group becomes `{arg}`.
 */
export function lexiconPhrase(patternRaw: string): LexiconPhrase {
    let phrase = patternRaw.trim();
    if (phrase.startsWith('^')) {
        phrase = phrase.slice(1);
    }
    if (phrase.endsWith('$')) {
        phrase = phrase.slice(0, -1);
    }
    phrase = phrase.replace(ANONYMOUS_GROUP, '{arg}');
    phrase = phrase
        .replace(/\\\./g, '.')
        .replace(/\\\?/g, '?')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
    phrase = phrase.replace(/\s+/g, ' ').trim();
    const legible = phrase.length > 0 && !/[[\]|*+?\\]/.test(phrase);
    return { phrase, legible };
}

interface MutableImpl {
    readonly binding: Binding;
    readonly signature: string;
    readonly methodName: string;
    readonly patternRaw: string;
    readonly path: string;
    readonly uri: Binding['uri'];
    readonly line: number;
    speakerCount: number;
}

interface MutableRow {
    readonly key: string;
    readonly keyword: ResolvedKeyword;
    readonly tokens: readonly string[];
    implementations: MutableImpl[];
    speakers: LexiconSpeaker[];
    readonly speakerKeys: Set<string>;
    dialects: LexiconDialect[];
}

export function buildLexicon(
    bindings: readonly Binding[],
    steps: readonly FeatureStep[],
    resolve: ResolveStep,
    options?: BuildLexiconOptions
): Lexicon {
    const listCap = options?.listCap ?? SUITE_MAP_LIST_CAP;
    const scanMax = options?.scanMax ?? MAX_ORPHAN_BINDING_SCAN;
    const skipped = bindings.length > scanMax;
    const grouped = new Map<string, MutableRow>();

    for (const binding of bindings) {
        const tokens = patternTokenSequence(binding.patternRaw);
        const key = `${binding.keyword}\u0001${tokens.join('\u0001')}`;
        let row = grouped.get(key);
        if (!row) {
            row = {
                key,
                keyword: binding.keyword,
                tokens,
                implementations: [],
                speakers: [],
                speakerKeys: new Set(),
                dialects: [],
            };
            grouped.set(key, row);
        }
        row.implementations.push({
            binding,
            signature: binding.signature || binding.methodName,
            methodName: binding.methodName,
            patternRaw: binding.patternRaw,
            path: binding.uri.fsPath,
            uri: binding.uri,
            line: binding.lineNumber,
            speakerCount: 0,
        });
    }

    if (!skipped) {
        for (const step of steps) {
            const result = resolve(step);
            if (result.status !== 'bound') {
                continue;
            }
            const winner = result.best?.binding ?? result.candidates[0]?.binding;
            if (!winner) {
                continue;
            }
            const key = lexiconKey(winner.keyword, winner.patternRaw);
            const row = grouped.get(key);
            if (!row) {
                continue;
            }
            const impl = row.implementations.find((item) => sameBinding(item.binding, winner));
            if (!impl) {
                continue;
            }
            const location = `${step.uri.toString()}:${step.lineNumber}`;
            if (row.speakerKeys.has(location)) {
                continue;
            }
            row.speakerKeys.add(location);
            impl.speakerCount += 1;
            row.speakers.push({
                uri: step.uri,
                lineNumber: step.lineNumber,
                text: step.rawText,
                path: step.uri.fsPath,
            });
        }
    }

    for (const row of grouped.values()) {
        row.implementations.sort(compareImpls);
    }

    const all = [...grouped.values()].sort(compareMutable);
    if (!skipped) {
        linkDialects(all);
    }

    const listed = all.slice(0, Math.max(0, listCap));
    const listedKeys = new Set(listed.map((row) => row.key));
    const rows = listed.map((row) => toRow(row, skipped, listedKeys));
    const usageLocations = skipped
        ? undefined
        : all.flatMap((row) => {
              const count = row.speakers.length;
              return row.speakers.map((speaker) => ({
                  uri: speaker.uri,
                  lineNumber: speaker.lineNumber,
                  key: row.key,
                  count,
              }));
          });

    let usages = 0;
    let unused = 0;
    let multi = 0;
    for (const row of all) {
        usages += row.speakers.length;
        if (!skipped && row.speakers.length === 0) {
            unused += 1;
        }
        if (row.implementations.length > 1) {
            multi += 1;
        }
    }

    return {
        rows,
        counts: {
            words: all.length,
            usages: skipped ? 0 : usages,
            unused: skipped ? 0 : unused,
            multi,
        },
        truncated: Math.max(0, all.length - listed.length),
        usagesSkipped: skipped,
        dialectsSkipped: skipped,
        usageLocations,
    };
}

function lexiconKey(keyword: ResolvedKeyword, patternRaw: string): string {
    return `${keyword}\u0001${patternTokenSequence(patternRaw).join('\u0001')}`;
}

function toRow(row: MutableRow, skipped: boolean, listedKeys: ReadonlySet<string>): LexiconRow {
    const implementations = [...row.implementations].sort(compareImpls).map((impl) => {
        const published: LexiconImplementation = {
            signature: impl.signature,
            methodName: impl.methodName,
            patternRaw: impl.patternRaw,
            path: impl.path,
            uri: impl.uri,
            line: impl.line,
        };
        if (skipped) {
            return published;
        }
        return { ...published, speakerCount: impl.speakerCount };
    });
    return {
        key: row.key,
        keyword: row.keyword,
        phrase: choosePhrase(implementations),
        implementations,
        speakers: skipped ? undefined : [...row.speakers].sort(compareSpeakers),
        dialects: skipped
            ? undefined
            : row.dialects.filter((dialect) => listedKeys.has(dialect.key)).slice(0, DIALECT_CAP),
    };
}

function choosePhrase(implementations: readonly LexiconImplementation[]): string {
    for (const impl of implementations) {
        const parsed = lexiconPhrase(impl.patternRaw);
        if (parsed.legible) {
            return parsed.phrase;
        }
    }
    return implementations[0]?.methodName ?? '';
}

function linkDialects(rows: readonly MutableRow[]): void {
    const byKeyword = new Map<ResolvedKeyword, MutableRow[]>();
    for (const row of rows) {
        const list = byKeyword.get(row.keyword);
        if (list) {
            list.push(row);
        } else {
            byKeyword.set(row.keyword, [row]);
        }
    }
    for (const group of byKeyword.values()) {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                if (!oneTokenApart(group[i].tokens, group[j].tokens)) {
                    continue;
                }
                const left = choosePhrase(group[i].implementations);
                const right = choosePhrase(group[j].implementations);
                group[i].dialects.push({ key: group[j].key, phrase: right });
                group[j].dialects.push({ key: group[i].key, phrase: left });
            }
        }
    }
    for (const row of rows) {
        row.dialects.sort((a, b) => a.phrase.localeCompare(b.phrase) || a.key.localeCompare(b.key));
    }
}

function oneTokenApart(left: readonly string[], right: readonly string[]): boolean {
    if (left.length < 2 || left.length !== right.length) {
        return false;
    }
    let diffs = 0;
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            diffs += 1;
            if (diffs > 1) {
                return false;
            }
        }
    }
    return diffs === 1;
}

function compareMutable(a: MutableRow, b: MutableRow): number {
    const phrase = choosePhrase(a.implementations).localeCompare(choosePhrase(b.implementations));
    return a.keyword.localeCompare(b.keyword) || phrase || a.key.localeCompare(b.key);
}

function compareImpls(a: MutableImpl, b: MutableImpl): number {
    return a.path.localeCompare(b.path) || a.line - b.line;
}

function compareSpeakers(a: LexiconSpeaker, b: LexiconSpeaker): number {
    return a.path.localeCompare(b.path) || a.lineNumber - b.lineNumber;
}
