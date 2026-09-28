/**
 * Advisory reuse hint for an unbound step.
 * Token overlap only — not a matcher, does not read binding.regex.
 */

import { humanizePatternForCompletion } from '../autocomplete/stepCompletion';
import type { ResolvedKeyword } from '../domain/types';

export const REUSE_MIN_SHARED_TOKENS = 2;
export const REUSE_JACCARD_MIN = 0.5;

const STOPWORDS = new Set([
    'a', 'an', 'the', 'i', 'to', 'of', 'and', 'or',
    'el', 'la', 'los', 'las', 'un', 'una', 'de', 'y',
]);

const PARAM = 'param';

export interface ReuseBindingSource {
    readonly patternRaw: string;
    readonly methodName: string;
    readonly keyword: ResolvedKeyword;
    readonly filePath: string;
    readonly line: number;
}

export type ReuseSuggestion =
    | { readonly kind: 'none' }
    | {
          readonly kind: 'reuse';
          readonly patternRaw: string;
          readonly methodName: string;
          readonly filePath: string;
          readonly line: number;
          readonly humanized: string;
          readonly score: number;
      };

/** Ordered significant tokens. Quoted text and numbers become the slot token `param`. */
export function reuseTokenSequence(text: string): readonly string[] {
    return tokenize(text);
}

/** Ordered tokens of a binding pattern, with captures and `{type}` as `param`. */
export function patternTokenSequence(patternRaw: string): readonly string[] {
    return tokenize(patternProse(patternRaw));
}

function tokenize(text: string): string[] {
    const slotted = text
        .toLowerCase()
        .replace(/"[^"]*"/g, ` ${PARAM} `)
        .replace(/'[^']*'/g, ` ${PARAM} `)
        .replace(/\b\d+\b/g, ` ${PARAM} `);
    const tokens: string[] = [];
    const re = /[a-z]{3,}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(slotted)) !== null) {
        const token = match[0];
        if (token !== PARAM && STOPWORDS.has(token)) {
            continue;
        }
        tokens.push(token);
    }
    return tokens;
}

/** Literal words of a pattern, with capture groups / CE placeholders as a slot token. */
function patternProse(patternRaw: string): string {
    let s = patternRaw.trim();
    if (s.startsWith('^')) {
        s = s.slice(1);
    }
    if (s.endsWith('$')) {
        s = s.slice(0, -1);
    }
    s = s.replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, ` ${PARAM} `);
    s = s.replace(/\((?:[^()\\]|\\.)*\)/g, ` ${PARAM} `);
    s = s.replace(/\\/g, '');
    return s;
}

function scoringTokens(patternRaw: string, methodName: string): Set<string> {
    const tokens = new Set(tokenize(patternProse(patternRaw)));
    const withName = humanizePatternForCompletion(patternRaw, methodName);
    const bare = humanizePatternForCompletion(patternRaw);
    // Method-name fallback (illegible regex) must not dilute the pattern words.
    if (withName === bare) {
        for (const token of tokenize(withName)) {
            tokens.add(token);
        }
    }
    return tokens;
}

function roundScore(shared: number, union: number): number {
    return Math.round((shared / union) * 100) / 100;
}

/**
 * Pick at most one indexed binding the step text could be rewritten toward.
 * Tie on the top score → none. Never a match status.
 */
export function suggestReuse(
    stepText: string,
    keyword: ResolvedKeyword,
    bindings: readonly ReuseBindingSource[]
): ReuseSuggestion {
    const stepTokens = new Set(tokenize(stepText));
    if (stepTokens.size === 0 || bindings.length === 0) {
        return { kind: 'none' };
    }

    let best: ReuseBindingSource | undefined;
    let bestShared = 0;
    let bestUnion = 0;
    let tie = false;

    for (const binding of bindings) {
        if (binding.keyword !== keyword) {
            continue;
        }
        const patternTokens = scoringTokens(binding.patternRaw, binding.methodName);
        let shared = 0;
        for (const token of stepTokens) {
            if (patternTokens.has(token)) {
                shared++;
            }
        }
        const union = stepTokens.size + patternTokens.size - shared;
        if (union === 0 || shared < REUSE_MIN_SHARED_TOKENS) {
            continue;
        }
        if (shared / union < REUSE_JACCARD_MIN) {
            continue;
        }
        if (!best || shared * bestUnion > bestShared * union) {
            best = binding;
            bestShared = shared;
            bestUnion = union;
            tie = false;
        } else if (shared * bestUnion === bestShared * union) {
            tie = true;
        }
    }

    if (!best || tie) {
        return { kind: 'none' };
    }

    return {
        kind: 'reuse',
        patternRaw: best.patternRaw,
        methodName: best.methodName,
        filePath: best.filePath,
        line: best.line,
        humanized: humanizePatternForCompletion(best.patternRaw, best.methodName),
        score: roundScore(bestShared, bestUnion),
    };
}
