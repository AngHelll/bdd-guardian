/**
 * Matching Module Exports
 */

export { normalizeWhitespace, generateCandidateTexts, extractPlaceholders } from './normalization';
export { calculateScore, compareScores } from './scoring';
export { createResolver, resolveAll, type ResolverOptions, type ResolverDependencies } from './resolver';
export { applyMatchingSettings } from './resolverDeps';
export { isBindingInScope, normalizeScopeTag } from './scopeFilter';
export {
    explainAmbiguity,
    ambiguityI18n,
    patternBreadthScore,
    truncateForDiagnostic,
    type AmbiguityExplanation,
    type AmbiguityCandidateInput,
} from './ambiguityExplain';
export {
    explainUnbound,
    unboundI18n,
    UNBOUND_OUT_OF_SCOPE_CAP,
    type UnboundExplanation,
    type UnboundOutOfScopeMatch,
    type UnboundI18nKey,
} from './unboundExplain';

// Re-export matching types from domain for convenience
export type { ResolveResult, MatchCandidate, MatchStatus } from '../domain/types';

