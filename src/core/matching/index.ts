/**
 * Matching Module Exports
 */

export { normalizeWhitespace, generateCandidateTexts, extractPlaceholders } from './normalization';
export { calculateScore, compareScores } from './scoring';
export { createResolver, resolveAll, type ResolverOptions, type ResolverDependencies } from './resolver';
export { applyMatchingSettings } from './resolverDeps';

// Re-export matching types from domain for convenience
export type { ResolveResult, MatchCandidate, MatchStatus } from '../domain/types';

