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
import { getBindingIdentity } from './bindingIdentity';
import { selectMatches } from './selectMatches';

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
    function preferSpecific(options: ResolverOptions): boolean {
        return options.preferSpecificBinding ?? deps.preferSpecificBinding ?? false;
    }

    function resolveText(
        step: FeatureStep,
        text: string,
        tags: readonly string[],
        options: ResolverOptions
    ): ResolveResult {
        const keywordBindings = deps.getBindingsByKeyword(step.keywordResolved);
        const selected = selectMatches(
            keywordBindings,
            step.keywordResolved,
            text,
            {
                tags,
                featureTitle: step.featureName,
                scenarioTitle: step.scenarioName,
            },
            step.argumentTail
        );
        return statusFromMatches(step, selected.matches, preferSpecific(options));
    }

    return function resolve(step: FeatureStep, options: ResolverOptions = {}): ResolveResult {
        const { debug = false } = options;
        const expansions = step.outlineExpansions;
        let result: ResolveResult;

        if (expansions && expansions.length > 0) {
            result = resolveOutline(step, expansions, options, resolveText);
        } else {
            const texts = step.candidateTexts.length > 0 ? step.candidateTexts : [step.normalizedText];
            result = resolveAnyCandidate(step, texts, step.tagsEffective, options, resolveText);
        }

        if (!debug) {
            return result;
        }
        const debugInfo: ResolveDebugInfo = {
            stepText: step.rawText,
            candidateTextCount: step.candidateTexts.length,
            sampleCandidates: step.candidateTexts.slice(0, 3),
            bindingsChecked: deps.getAllBindings().length,
        };
        return { ...result, debug: debugInfo };
    };
}

/**
 * Steps without per-row expansions: the first candidate text that produces
 * any in-scope match wins, then that text is judged on its own.
 * Outline rows do not use this path.
 */
function resolveAnyCandidate(
    step: FeatureStep,
    texts: readonly string[],
    tags: readonly string[],
    options: ResolverOptions,
    resolveText: (step: FeatureStep, text: string, tags: readonly string[], options: ResolverOptions) => ResolveResult
): ResolveResult {
    let firstHit: ResolveResult | undefined;
    for (const text of texts) {
        const result = resolveText(step, text, tags, options);
        if (result.status !== 'unbound') {
            firstHit = result;
            break;
        }
    }
    return firstHit ?? resolveText(step, texts[0] ?? step.normalizedText, tags, options);
}

function resolveOutline(
    step: FeatureStep,
    expansions: readonly { text: string; tags: readonly string[] }[],
    options: ResolverOptions,
    resolveText: (step: FeatureStep, text: string, tags: readonly string[], options: ResolverOptions) => ResolveResult
): ResolveResult {
    const rowResults = expansions.map((row) => resolveText(step, row.text, row.tags, options));
    const ambiguous = rowResults.find((row) => row.status === 'ambiguous');
    if (ambiguous) {
        return { step, status: 'ambiguous', best: ambiguous.best, candidates: ambiguous.candidates };
    }
    if (step.outlineTruncated || rowResults.some((row) => row.status === 'unbound')) {
        return { step, status: 'unbound', candidates: [] };
    }

    const candidates: MatchCandidate[] = [];
    const seen = new Set<string>();
    for (const row of rowResults) {
        const best = row.best;
        if (!best) {
            continue;
        }
        const id = getBindingIdentity(best.binding);
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        candidates.push(best);
    }
    return {
        step,
        status: 'bound',
        best: candidates[0],
        candidates,
    };
}

function statusFromMatches(
    step: FeatureStep,
    matches: readonly MatchCandidate[],
    preferSpecificBinding: boolean
): ResolveResult {
    if (matches.length === 0) {
        return { step, status: 'unbound', candidates: [] };
    }
    if (matches.length === 1) {
        return { step, status: 'bound', best: matches[0], candidates: matches };
    }
    const status: MatchStatus = preferSpecificBinding && matches[0].score > matches[1].score
        ? 'bound'
        : 'ambiguous';
    return { step, status, best: matches[0], candidates: matches };
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
