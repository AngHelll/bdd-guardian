/**
 * Resolver
 * The SINGLE public API for resolving steps to bindings
 * 
 * Used by CodeLens, Diagnostics, DefinitionProvider, and HoverProvider
 * All resolution logic goes through this module.
 */

import {
    FeatureStep,
    Binding,
    ResolveResult,
    MatchCandidate,
    MatchStatus,
    ResolveDebugInfo,
    ResolvedKeyword,
} from '../domain/types';
import { calculateScore, compareScores } from './scoring';
import { getBindingIdentity } from './bindingIdentity';
import { isBindingInScope } from './scopeFilter';

/**
 * Resolver options
 */
export interface ResolverDependencies {
    /** Get all bindings */
    getAllBindings: () => readonly Binding[];
    /** Get bindings by keyword */
    getBindingsByKeyword: (keyword: ResolvedKeyword) => readonly Binding[];
    /** Prefer highest score when multiple bindings match (legacy; default false) */
    preferSpecificBinding?: boolean;
}

export interface ResolverOptions {
    /** Enable debug information in results */
    debug?: boolean;
    /** Override deps.preferSpecificBinding for this call */
    preferSpecificBinding?: boolean;
}

/**
 * Create a resolver function with injected dependencies
 */
export function createResolver(deps: ResolverDependencies) {
    return function resolve(step: FeatureStep, options: ResolverOptions = {}): ResolveResult {
        const candidates: MatchCandidate[] = [];
        const seenBindings = new Set<string>();
        const { debug = false } = options;

        const addCandidate = (matchResult: MatchCandidate): void => {
            const key = getBindingIdentity(matchResult.binding);
            if (seenBindings.has(key)) {
                return;
            }
            seenBindings.add(key);
            candidates.push(matchResult);
        };

        // keywordResolved is already Given, When or Then.
        // And, But and * are resolved by the Gherkin parser before this call.
        // [StepDefinition] is stored once per keyword, so it matches here.
        // A binding of another keyword is not a candidate.
        const keywordBindings = deps.getBindingsByKeyword(step.keywordResolved);

        for (const binding of keywordBindings) {
            if (!isBindingInScope(binding, step.tagsEffective)) {
                continue;
            }
            const matchResult = tryMatch(binding, step.candidateTexts, true);
            if (matchResult) {
                addCandidate(matchResult);
            }
        }

        // Sort by score descending
        candidates.sort((a, b) => compareScores(a.score, b.score));

        // Determine status
        let status: MatchStatus;
        let best: MatchCandidate | undefined;

        if (candidates.length === 0) {
            status = 'unbound';
        } else if (candidates.length === 1) {
            status = 'bound';
            best = candidates[0];
        } else {
            const preferSpecific =
                options.preferSpecificBinding ?? deps.preferSpecificBinding ?? false;
            if (preferSpecific && candidates[0].score > candidates[1].score) {
                status = 'bound';
            } else {
                status = 'ambiguous';
            }
            best = candidates[0];
        }

        // Build result
        const result: ResolveResult = {
            step,
            status,
            best,
            candidates,
        };

        // Add debug info if requested
        if (debug) {
            const debugInfo: ResolveDebugInfo = {
                stepText: step.rawText,
                candidateTextCount: step.candidateTexts.length,
                sampleCandidates: step.candidateTexts.slice(0, 3),
                bindingsChecked: deps.getAllBindings().length,
            };
            return { ...result, debug: debugInfo };
        }

        return result;
    };
}

/**
 * Try to match a binding against candidate texts
 */
function tryMatch(
    binding: Binding,
    candidateTexts: readonly string[],
    keywordMatched: boolean
): MatchCandidate | null {
    let matchedCandidate: string | undefined;

    // Test regex against each candidate
    for (const candidate of candidateTexts) {
        // Reset regex state for multiple tests
        binding.regex.lastIndex = 0;
        if (binding.regex.test(candidate)) {
            matchedCandidate = candidate;
            break;
        }
    }

    if (!matchedCandidate) {
        return null;
    }

    const score = calculateScore(binding, keywordMatched);

    return {
        binding,
        score,
        keywordMatched,
        matchedCandidate,
    };
}

/**
 * Resolve multiple steps at once
 */
export function resolveAll(
    resolve: ReturnType<typeof createResolver>,
    steps: readonly FeatureStep[],
    options: ResolverOptions = {}
): ResolveResult[] {
    return steps.map(step => resolve(step, options));
}
