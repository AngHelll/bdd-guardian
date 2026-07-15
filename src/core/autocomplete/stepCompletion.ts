/**
 * Pure step autocomplete helpers — filter/humanize indexed bindings for Gherkin completion.
 * No VS Code API; no resolver/matching path.
 */

import type { ResolvedKeyword } from '../domain/types';

export const MAX_STEP_COMPLETIONS = 40;

const STEP_KEYWORD_LINE =
    /^\s*(Given|When|Then|And|But)(?:\s+(.*))?$/i;
const NON_STEP_LINE = /^\s*(?:#|@|\|)/;

export interface BindingCompletionSource {
    readonly keyword: ResolvedKeyword;
    readonly patternRaw: string;
    readonly methodName: string;
    /** Relative or absolute path for documentation */
    readonly filePath?: string;
}

export interface StepLineCompletionContext {
    /** Line is eligible for Guardian step completions */
    readonly eligible: boolean;
    /** Resolved Given/When/Then for filtering; null → no keyword filter */
    readonly keywordResolved: ResolvedKeyword | null;
    /** True when line already has Given/When/Then/And/But */
    readonly keywordPresent: boolean;
    /** Typed text after the keyword (prefix filter) */
    readonly prefix: string;
    /** Character offset where step body starts (after keyword + space), or 0 if keyword only/missing */
    readonly bodyStartColumn: number;
}

export interface StepCompletionCandidate {
    readonly label: string;
    readonly insertText: string;
    readonly detail: string;
    readonly documentation: string;
    readonly sortText: string;
    readonly patternRaw: string;
    readonly methodName: string;
}

/**
 * Humanize a binding pattern into approximate step text for insertion.
 */
export function humanizePatternForCompletion(
    patternRaw: string,
    methodName?: string
): string {
    let s = patternRaw.trim();
    if (s.startsWith('^')) {
        s = s.slice(1);
    }
    if (s.endsWith('$')) {
        s = s.slice(0, -1);
    }

    s = s
        .replace(/\{int\}/gi, '1')
        .replace(/\{float\}/gi, '1.0')
        .replace(/\{string\}/gi, '"value"')
        .replace(/\{word\}/gi, 'word')
        .replace(/\(\\d\+\)/g, '1')
        .replace(/"\(\.\*\)"/g, '"value"')
        .replace(/'\(\.\*\)'/g, "'value'")
        .replace(/\(\[\^"\]\*\)/g, 'value')
        .replace(/\(\[\^'\]\*\)/g, 'value')
        .replace(/\(\.\*\)/g, 'value')
        .replace(/\(\.\+\)/g, 'value');

    // Unescape common regex literals for readability
    s = s.replace(/\\\./g, '.').replace(/\\\?/g, '?').replace(/\\\(/g, '(').replace(/\\\)/g, ')');

    if (looksLikeIllegibleRegex(s) && methodName) {
        return methodNameToPhrase(methodName);
    }
    if (looksLikeIllegibleRegex(s)) {
        return patternRaw.replace(/^\^/, '').replace(/\$$/, '');
    }

    return s.trim();
}

function looksLikeIllegibleRegex(s: string): boolean {
    return /[\\[\]|*+?{}]/.test(s);
}

function methodNameToPhrase(methodName: string): string {
    return methodName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Analyze a feature line for completion eligibility and prefix.
 */
export function parseStepCompletionLine(
    lineText: string,
    previousStrongKeyword: ResolvedKeyword = 'Given'
): StepLineCompletionContext {
    const trimmedStart = lineText.trimStart();
    if (NON_STEP_LINE.test(lineText) || trimmedStart.startsWith('Feature:') ||
        trimmedStart.startsWith('Scenario') ||
        trimmedStart.startsWith('Background:') ||
        trimmedStart.startsWith('Examples:')) {
        return {
            eligible: false,
            keywordResolved: null,
            keywordPresent: false,
            prefix: '',
            bodyStartColumn: 0,
        };
    }

    const match = lineText.match(STEP_KEYWORD_LINE);
    if (!match) {
        return {
            eligible: false,
            keywordResolved: null,
            keywordPresent: false,
            prefix: '',
            bodyStartColumn: 0,
        };
    }

    const keywordToken = match[1];
    const body = (match[2] ?? '').trimStart();
    const keywordPresent = true;
    const leadWs = lineText.match(/^\s*/)?.[0].length ?? 0;
    const keywordLen = keywordToken.length;
    // After keyword: either end of line, or one+ spaces then body
    const afterKeyword = leadWs + keywordLen;
    const rest = lineText.slice(afterKeyword);
    const spaceMatch = rest.match(/^\s*/);
    const bodyStartColumn =
        rest.length === 0 ? afterKeyword : afterKeyword + (spaceMatch?.[0].length ?? 0);

    const lower = keywordToken.toLowerCase();
    let keywordResolved: ResolvedKeyword;
    if (lower === 'given') {
        keywordResolved = 'Given';
    } else if (lower === 'when') {
        keywordResolved = 'When';
    } else if (lower === 'then') {
        keywordResolved = 'Then';
    } else {
        keywordResolved = previousStrongKeyword;
    }

    return {
        eligible: true,
        keywordResolved,
        keywordPresent,
        prefix: body.trimEnd(),
        bodyStartColumn,
    };
}

/**
 * Resolve last strong keyword (Given/When/Then) above the current line.
 */
export function findPreviousStrongKeyword(
    linesAbove: readonly string[],
    fallback: ResolvedKeyword = 'Given'
): ResolvedKeyword {
    for (let i = linesAbove.length - 1; i >= 0; i--) {
        const m = linesAbove[i].match(/^\s*(Given|When|Then|And|But)\b/i);
        if (!m) {
            continue;
        }
        const lower = m[1].toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
    }
    return fallback;
}

export interface FilterBindingsOptions {
    readonly keyword: ResolvedKeyword | null;
    readonly prefix: string;
    readonly includeKeywordInInsert: boolean;
    readonly limit?: number;
}

/**
 * Filter and rank bindings into completion candidates.
 */
export function filterBindingsForCompletion(
    bindings: readonly BindingCompletionSource[],
    options: FilterBindingsOptions
): StepCompletionCandidate[] {
    const limit = options.limit ?? MAX_STEP_COMPLETIONS;
    const prefix = options.prefix.trim().toLowerCase();
    const keyword = options.keyword;

    const pooled =
        keyword === null
            ? bindings
            : bindings.filter((b) => b.keyword === keyword);

    type Ranked = StepCompletionCandidate & { rank: number; len: number };

    const ranked: Ranked[] = [];
    for (const b of pooled) {
        const body = humanizePatternForCompletion(b.patternRaw, b.methodName);
        const haystack = `${b.patternRaw} ${b.methodName} ${body}`.toLowerCase();
        let rank: number;
        if (!prefix) {
            rank = 2;
        } else if (body.toLowerCase().startsWith(prefix) || b.patternRaw.toLowerCase().startsWith(prefix)) {
            rank = 0;
        } else if (haystack.includes(prefix)) {
            rank = 1;
        } else {
            continue;
        }

        const insertText = options.includeKeywordInInsert
            ? `${b.keyword} ${body}`
            : body;

        ranked.push({
            label: body,
            insertText,
            detail: b.methodName,
            documentation: [b.patternRaw, b.filePath].filter(Boolean).join('\n'),
            sortText: '',
            patternRaw: b.patternRaw,
            methodName: b.methodName,
            rank,
            len: b.patternRaw.length,
        });
    }

    ranked.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.len !== b.len) return a.len - b.len;
        return a.label.localeCompare(b.label);
    });

    return ranked.slice(0, limit).map((c, i) => ({
        label: c.label,
        insertText: c.insertText,
        detail: c.detail,
        documentation: c.documentation,
        sortText: `${c.rank}_${String(i).padStart(3, '0')}`,
        patternRaw: c.patternRaw,
        methodName: c.methodName,
    }));
}
