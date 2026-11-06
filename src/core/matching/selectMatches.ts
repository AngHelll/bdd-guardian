/**
 * Regex + scope + argument shape for one step text.
 * Keeps the bindings with the most matching scope criteria.
 * Several attributes of one method collapse to a single candidate.
 */

import type { Binding, MatchCandidate, ResolvedKeyword, StepArgumentTail } from '../domain/types';
import { argumentShapeCompatible } from './argumentShape';
import { getBindingIdentity } from './bindingIdentity';
import { matchBindingScope, type ScopeMatchContext } from './scopeFilter';
import { calculateScore, compareScores } from './scoring';

export interface TextSelection {
    readonly matches: readonly MatchCandidate[];
    readonly outOfScope: readonly Binding[];
    readonly shapeMismatch: readonly Binding[];
}

interface ScopedHit extends MatchCandidate {
    readonly scopeMatches: number;
}

export function selectMatches(
    bindings: readonly Binding[],
    keyword: ResolvedKeyword,
    text: string,
    ctx: ScopeMatchContext,
    argumentTail: StepArgumentTail | undefined
): TextSelection {
    const preliminary: ScopedHit[] = [];
    const outOfScope: Binding[] = [];
    const shapeMismatch: Binding[] = [];

    for (const binding of bindings) {
        if (binding.keyword !== keyword) {
            continue;
        }
        binding.regex.lastIndex = 0;
        if (!binding.regex.test(text)) {
            continue;
        }
        const scope = matchBindingScope(binding, ctx);
        if (!scope.inScope) {
            outOfScope.push(binding);
            continue;
        }
        if (!argumentShapeCompatible(binding, text, argumentTail)) {
            shapeMismatch.push(binding);
            continue;
        }
        preliminary.push({
            binding,
            score: calculateScore(binding, true),
            keywordMatched: true,
            matchedCandidate: text,
            scopeMatches: scope.scopeMatches,
        });
    }

    const byIdentity = new Map<string, ScopedHit>();
    for (const hit of preliminary) {
        const id = getBindingIdentity(hit.binding);
        const previous = byIdentity.get(id);
        if (
            !previous
            || hit.scopeMatches > previous.scopeMatches
            || (hit.scopeMatches === previous.scopeMatches && hit.score > previous.score)
        ) {
            byIdentity.set(id, hit);
        }
    }

    const deduped = [...byIdentity.values()];
    if (deduped.length === 0) {
        return { matches: [], outOfScope, shapeMismatch };
    }

    const maxScope = deduped.reduce((max, hit) => Math.max(max, hit.scopeMatches), 0);
    const matches = deduped
        .filter((hit) => hit.scopeMatches === maxScope)
        .map((hit) => ({
            binding: hit.binding,
            score: hit.score,
            keywordMatched: hit.keywordMatched,
            matchedCandidate: hit.matchedCandidate,
        }))
        .sort((a, b) => compareScores(a.score, b.score));

    return { matches, outOfScope, shapeMismatch };
}
