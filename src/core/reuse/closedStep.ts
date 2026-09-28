/**
 * Closed-step advice: one word keeps a step from being reusable.
 * Not a matcher. Call only when suggestReuse returned none.
 */

import { humanizePatternForCompletion } from '../autocomplete/stepCompletion';
import type { ResolvedKeyword } from '../domain/types';
import {
    patternTokenSequence,
    reuseTokenSequence,
    type ReuseBindingSource,
} from './suggestReuse';

const SLOT = 'param';

export interface ClusterItem {
    readonly text: string;
    readonly keyword: ResolvedKeyword;
    readonly line: number;
}

export interface LiteralCluster {
    readonly keyword: ResolvedKeyword;
    /** Earliest step line in the cluster. */
    readonly line: number;
    /** Distinct words at the single varying position (lowercase). */
    readonly words: readonly string[];
}

export type ClosedSuggestion =
    | { readonly kind: 'none' }
    | {
          readonly kind: 'useSlot';
          readonly word: string;
          readonly humanized: string;
          readonly methodName: string;
          readonly filePath: string;
          readonly line: number;
      }
    | {
          readonly kind: 'parameterize';
          readonly word: string;
          readonly humanized: string;
          readonly methodName: string;
          readonly filePath: string;
          readonly line: number;
      };

interface DiffHit {
    readonly word: string;
    readonly binding: ReuseBindingSource;
    readonly slotOnPattern: boolean;
}

function singleWordDiff(stepText: string, patternRaw: string): { word: string; slotOnPattern: boolean } | undefined {
    const stepTokens = reuseTokenSequence(stepText);
    const patternTokens = patternTokenSequence(patternRaw);
    if (stepTokens.length < 2 || stepTokens.length !== patternTokens.length) {
        return undefined;
    }
    let index = -1;
    for (let i = 0; i < stepTokens.length; i++) {
        if (stepTokens[i] === patternTokens[i]) {
            continue;
        }
        if (index !== -1) {
            return undefined;
        }
        index = i;
    }
    if (index === -1) {
        return undefined;
    }
    const word = stepTokens[index];
    const patternWord = patternTokens[index];
    if (word === SLOT) {
        return undefined;
    }
    return { word, slotOnPattern: patternWord === SLOT };
}

/**
 * Steps (or other texts) that share every token except one closed word.
 * Quoted values and numbers are slots and do not form a cluster.
 */
export function findLiteralClusters(items: readonly ClusterItem[]): LiteralCluster[] {
    interface Prepared extends ClusterItem {
        readonly tokens: readonly string[];
    }
    const prepared: Prepared[] = [];
    for (const item of items) {
        const tokens = reuseTokenSequence(item.text);
        if (tokens.length >= 2) {
            prepared.push({ ...item, tokens });
        }
    }

    interface Group {
        readonly index: number;
        readonly members: Prepared[];
    }
    const groups: Group[] = [];
    const buckets = new Map<string, Prepared[]>();
    for (const item of prepared) {
        for (let i = 0; i < item.tokens.length; i++) {
            if (item.tokens[i] === SLOT) {
                continue;
            }
            const stem = item.tokens.map((token, j) => (j === i ? '*' : token)).join('\u0001');
            const key = `${item.keyword}|${i}|${stem}`;
            const list = buckets.get(key);
            if (list) {
                list.push(item);
            } else {
                const created = [item];
                buckets.set(key, created);
                groups.push({ index: i, members: created });
            }
        }
    }

    const ranked = groups
        .map((group) => {
            const words = [...new Set(group.members.map((member) => member.tokens[group.index]))].filter(
                (word) => word !== SLOT
            );
            return { group, words };
        })
        .filter((entry) => entry.words.length >= 2)
        .sort((a, b) => b.group.members.length - a.group.members.length || a.group.members[0].line - b.group.members[0].line);

    const usedLines = new Set<number>();
    const clusters: LiteralCluster[] = [];
    for (const entry of ranked) {
        if (entry.group.members.some((member) => usedLines.has(member.line))) {
            continue;
        }
        for (const member of entry.group.members) {
            usedLines.add(member.line);
        }
        const line = Math.min(...entry.group.members.map((member) => member.line));
        clusters.push({
            keyword: entry.group.members[0].keyword,
            line,
            words: [...entry.words].sort(),
        });
    }
    return clusters;
}

/**
 * One closed-word hint against indexed bindings. Several equally close bindings → none.
 */
export function suggestClosedStep(
    stepText: string,
    keyword: ResolvedKeyword,
    bindings: readonly ReuseBindingSource[]
): ClosedSuggestion {
    const hits: DiffHit[] = [];
    for (const binding of bindings) {
        if (binding.keyword !== keyword) {
            continue;
        }
        const diff = singleWordDiff(stepText, binding.patternRaw);
        if (!diff) {
            continue;
        }
        hits.push({ word: diff.word, binding, slotOnPattern: diff.slotOnPattern });
    }

    const slots = hits.filter((hit) => hit.slotOnPattern);
    const literals = hits.filter((hit) => !hit.slotOnPattern);
    const chosen = slots.length === 1 ? slots[0] : literals.length === 1 ? literals[0] : undefined;
    if (!chosen) {
        return { kind: 'none' };
    }
    const base = {
        word: chosen.word,
        humanized: humanizePatternForCompletion(chosen.binding.patternRaw, chosen.binding.methodName),
        methodName: chosen.binding.methodName,
        filePath: chosen.binding.filePath,
        line: chosen.binding.line,
    };
    return chosen.slotOnPattern ? { kind: 'useSlot', ...base } : { kind: 'parameterize', ...base };
}
