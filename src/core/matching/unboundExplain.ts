/**
 * Explain why a step is unbound (pure — no VS Code / no resolver).
 * Does not change matching policy; uses the index `binding.regex` and `isBindingInScope`.
 */

import type { Binding, FeatureStep } from '../domain/types';
import { isBindingInScope, normalizeScopeTag } from './scopeFilter';

export const UNBOUND_OUT_OF_SCOPE_CAP = 3;

export type UnboundSummaryKey = 'emptyIndex' | 'scopeExcluded' | 'generic';

export interface UnboundOutOfScopeMatch {
    readonly methodName: string;
    readonly patternRaw: string;
    readonly scopeTags: readonly string[];
    readonly binding: Binding;
}

export interface UnboundExplanation {
    readonly summaryKey: UnboundSummaryKey;
    readonly indexedCount: number;
    readonly outOfScopeMatches: readonly UnboundOutOfScopeMatch[];
    /** Full out-of-scope regex-match count (may exceed listed matches). */
    readonly outOfScopeCount: number;
    readonly requiredTags?: readonly string[];
}

export type UnboundI18nKey =
    | 'unboundEmptyIndex'
    | 'unboundScopeExcluded'
    | 'unboundGeneric';

function regexMatchesStep(binding: Binding, candidateTexts: readonly string[]): boolean {
    for (const candidate of candidateTexts) {
        binding.regex.lastIndex = 0;
        if (binding.regex.test(candidate)) {
            return true;
        }
    }
    return false;
}

function uniqueDisplayTags(scopeTags: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of scopeTags) {
        const normalized = normalizeScopeTag(tag);
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        out.push(`@${normalized}`);
    }
    return out;
}

function toOutOfScopeMatch(binding: Binding): UnboundOutOfScopeMatch {
    return {
        methodName: binding.methodName,
        patternRaw: binding.patternRaw,
        scopeTags: binding.scopeTags ?? [],
        binding,
    };
}

/**
 * Classify an already-unbound step against the indexed bindings.
 * Priority: emptyIndex → scopeExcluded → generic.
 * In-scope regex matches (caller should not pass a bound step) → generic; never invents bound.
 */
export function explainUnbound(
    step: FeatureStep,
    bindings: readonly Binding[]
): UnboundExplanation {
    const indexedCount = bindings.length;
    if (indexedCount === 0) {
        return {
            summaryKey: 'emptyIndex',
            indexedCount: 0,
            outOfScopeMatches: [],
            outOfScopeCount: 0,
        };
    }

    const outOfScope: Binding[] = [];
    let inScopeMatch = false;
    for (const binding of bindings) {
        if (!regexMatchesStep(binding, step.candidateTexts)) {
            continue;
        }
        if (isBindingInScope(binding, step.tagsEffective)) {
            inScopeMatch = true;
        } else {
            outOfScope.push(binding);
        }
    }

    if (inScopeMatch) {
        return {
            summaryKey: 'generic',
            indexedCount,
            outOfScopeMatches: [],
            outOfScopeCount: 0,
        };
    }

    if (outOfScope.length > 0) {
        const requiredTags = uniqueDisplayTags(outOfScope.flatMap((b) => b.scopeTags ?? []));
        return {
            summaryKey: 'scopeExcluded',
            indexedCount,
            outOfScopeMatches: outOfScope.slice(0, UNBOUND_OUT_OF_SCOPE_CAP).map(toOutOfScopeMatch),
            outOfScopeCount: outOfScope.length,
            requiredTags,
        };
    }

    return {
        summaryKey: 'generic',
        indexedCount,
        outOfScopeMatches: [],
        outOfScopeCount: 0,
    };
}

/**
 * Map explanation to i18n key + args for `t(key, ...args)`.
 */
export function unboundI18n(
    explanation: UnboundExplanation
): { key: UnboundI18nKey; args: string[] } {
    switch (explanation.summaryKey) {
        case 'emptyIndex':
            return { key: 'unboundEmptyIndex', args: [] };
        case 'scopeExcluded':
            return {
                key: 'unboundScopeExcluded',
                args: [
                    String(explanation.outOfScopeCount),
                    (explanation.requiredTags ?? []).join(', '),
                ],
            };
        case 'generic':
        default:
            return {
                key: 'unboundGeneric',
                args: [String(explanation.indexedCount)],
            };
    }
}
