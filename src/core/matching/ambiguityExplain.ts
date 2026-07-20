/**
 * Explain why multiple bindings match a step (pure — no VS Code / no resolver).
 * Does not change matching policy; only classifies collisions for UI copy.
 */

import type { MatchCandidate } from '../domain/types';

export type AmbiguitySummaryKey = 'duplicatePattern' | 'nearTies' | 'overlap' | 'generic';

export type AmbiguityReasonCode = 'samePattern' | 'scoreTie' | 'broadVsSpecific';

export interface AmbiguityBindingRef {
    readonly methodName: string;
    readonly patternRaw: string;
    readonly score: number;
}

export interface AmbiguityReason {
    readonly code: AmbiguityReasonCode;
    readonly bindingA: AmbiguityBindingRef;
    readonly bindingB?: AmbiguityBindingRef;
}

export interface AmbiguityExplanation {
    readonly summaryKey: AmbiguitySummaryKey;
    readonly reasons: readonly AmbiguityReason[];
    readonly topPatterns: readonly string[];
    readonly matchCount: number;
    /** Interpolation for samePattern summary */
    readonly samePattern?: string;
    /** Interpolation for scoreTie */
    readonly tiedScore?: number;
    /** Interpolation for broadVsSpecific */
    readonly broadPattern?: string;
    readonly specificPattern?: string;
}

export type AmbiguityCandidateInput = MatchCandidate | AmbiguityBindingRef;

function toRef(candidate: AmbiguityCandidateInput): AmbiguityBindingRef {
    if ('binding' in candidate) {
        return {
            methodName: candidate.binding.methodName,
            patternRaw: candidate.binding.patternRaw,
            score: candidate.score,
        };
    }
    return candidate;
}

function normalizePattern(pattern: string): string {
    return pattern.trim();
}

/** Higher = broader / more wildcard-heavy (MVP heuristic — no regex recompile). */
export function patternBreadthScore(patternRaw: string): number {
    const p = patternRaw;
    const wildcards = (p.match(/\.\*|\.\+/g) ?? []).length;
    const digitClasses = (p.match(/\\d/g) ?? []).length;
    // Prefer shorter patterns as slightly broader when wildcard counts tie
    return wildcards * 10 - digitClasses * 3 - Math.min(p.length, 80) * 0.01;
}

/**
 * Classify ambiguity among matching candidates (already scored by resolver).
 * Priority: samePattern → scoreTie → broadVsSpecific → generic.
 */
export function explainAmbiguity(
    candidates: readonly AmbiguityCandidateInput[]
): AmbiguityExplanation {
    const refs = [...candidates].map(toRef).sort((a, b) => b.score - a.score);
    const matchCount = refs.length;
    const topPatterns = [
        ...new Set(refs.slice(0, 3).map((r) => normalizePattern(r.patternRaw))),
    ].slice(0, 3);

    if (matchCount < 2) {
        return {
            summaryKey: 'generic',
            reasons: [],
            topPatterns,
            matchCount,
        };
    }

    const reasons: AmbiguityReason[] = [];
    const a = refs[0];
    const b = refs[1];
    const patternA = normalizePattern(a.patternRaw);
    const patternB = normalizePattern(b.patternRaw);

    // 1. samePattern — any pair among top candidates with equal pattern
    const byPattern = new Map<string, AmbiguityBindingRef[]>();
    for (const r of refs) {
        const key = normalizePattern(r.patternRaw);
        const list = byPattern.get(key) ?? [];
        list.push(r);
        byPattern.set(key, list);
    }
    let samePatternValue: string | undefined;
    for (const [pattern, group] of byPattern) {
        if (group.length >= 2) {
            reasons.push({
                code: 'samePattern',
                bindingA: group[0],
                bindingB: group[1],
            });
            samePatternValue = pattern;
            break;
        }
    }
    if (samePatternValue !== undefined) {
        return {
            summaryKey: 'duplicatePattern',
            reasons,
            topPatterns,
            matchCount,
            samePattern: samePatternValue,
        };
    }

    // 2. scoreTie — top-2 identical scores
    if (a.score === b.score) {
        reasons.push({ code: 'scoreTie', bindingA: a, bindingB: b });
        return {
            summaryKey: 'nearTies',
            reasons,
            topPatterns,
            matchCount,
            tiedScore: a.score,
        };
    }

    // 3. broadVsSpecific — different patterns, one clearly broader
    if (patternA !== patternB) {
        const breadthA = patternBreadthScore(patternA);
        const breadthB = patternBreadthScore(patternB);
        if (breadthA !== breadthB) {
            const broad = breadthA > breadthB ? a : b;
            const specific = breadthA > breadthB ? b : a;
            reasons.push({
                code: 'broadVsSpecific',
                bindingA: broad,
                bindingB: specific,
            });
            return {
                summaryKey: 'overlap',
                reasons,
                topPatterns,
                matchCount,
                broadPattern: normalizePattern(broad.patternRaw),
                specificPattern: normalizePattern(specific.patternRaw),
            };
        }
    }

    return {
        summaryKey: 'generic',
        reasons,
        topPatterns,
        matchCount,
    };
}

export type AmbiguityI18nKey =
    | 'ambiguitySamePattern'
    | 'ambiguityScoreTie'
    | 'ambiguityBroadVsSpecific'
    | 'ambiguityGeneric';

/**
 * Map explanation to i18n key + args for `t(key, ...args)`.
 */
export function ambiguityI18n(
    explanation: AmbiguityExplanation
): { key: AmbiguityI18nKey; args: string[] } {
    switch (explanation.summaryKey) {
        case 'duplicatePattern':
            return {
                key: 'ambiguitySamePattern',
                args: [explanation.samePattern ?? explanation.topPatterns[0] ?? ''],
            };
        case 'nearTies':
            return {
                key: 'ambiguityScoreTie',
                args: [String(explanation.tiedScore ?? 0)],
            };
        case 'overlap':
            return {
                key: 'ambiguityBroadVsSpecific',
                args: [
                    explanation.broadPattern ?? '',
                    explanation.specificPattern ?? '',
                ],
            };
        case 'generic':
        default:
            return {
                key: 'ambiguityGeneric',
                args: [String(explanation.matchCount)],
            };
    }
}

/** Truncate long patterns for Problems panel. */
export function truncateForDiagnostic(text: string, max = 48): string {
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, max - 1)}…`;
}
