/**
 * Explain why a step is unbound (pure — no VS Code / no resolver).
 * Uses the same scope, shape, and outline-row rules as the resolver.
 * Does not change status and does not add a second matcher.
 */

import type { Binding, FeatureStep } from '../domain/types';
import { scopeRulesOf } from './scopeFilter';
import { selectMatches } from './selectMatches';

export const UNBOUND_OUT_OF_SCOPE_CAP = 3;

export type UnboundSummaryKey =
    | 'emptyIndex'
    | 'scopeExcluded'
    | 'signature'
    | 'outlineRow'
    | 'outlineLimited'
    | 'generic';

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
    /** Method names whose text matched but whose signature did not. */
    readonly signatureMethods?: readonly string[];
    /** Examples row label that has no binding. */
    readonly rowLabel?: string;
}

export type UnboundI18nKey =
    | 'unboundEmptyIndex'
    | 'unboundScopeExcluded'
    | 'unboundScopeDetail'
    | 'unboundSignature'
    | 'unboundOutlineRow'
    | 'unboundOutlineLimited'
    | 'unboundGeneric';

function uniqueDisplayTags(scopeTags: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of scopeTags) {
        const normalized = tag.trim().replace(/^@+/, '').toLowerCase();
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

interface ScopeNeed {
    readonly tags: readonly string[];
    readonly detail: string;
    readonly hasTitle: boolean;
}

function scopeNeed(bindings: readonly Binding[]): ScopeNeed {
    const tags: string[] = [];
    const features: string[] = [];
    const scenarios: string[] = [];
    for (const binding of bindings) {
        for (const rule of scopeRulesOf(binding)) {
            if (rule.tag) {
                tags.push(rule.tag);
            }
            if (rule.feature) {
                features.push(rule.feature);
            }
            if (rule.scenario) {
                scenarios.push(rule.scenario);
            }
        }
    }
    const tagLabels = uniqueDisplayTags(tags);
    const featureLabels = [...new Set(features)].map((title) => `feature "${title}"`);
    const scenarioLabels = [...new Set(scenarios)].map((title) => `scenario "${title}"`);
    return {
        tags: tagLabels,
        detail: [...tagLabels, ...featureLabels, ...scenarioLabels].join(', '),
        hasTitle: featureLabels.length + scenarioLabels.length > 0,
    };
}

function emptyExplanation(indexedCount: number): UnboundExplanation {
    return {
        summaryKey: 'generic',
        indexedCount,
        outOfScopeMatches: [],
        outOfScopeCount: 0,
    };
}

/**
 * Classify an already-unbound step against the indexed bindings.
 * Priority: emptyIndex → signature → scope → outline row → outline limit → generic.
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

    const rows = step.outlineExpansions && step.outlineExpansions.length > 0
        ? step.outlineExpansions.map((row) => ({ text: row.text, tags: row.tags, label: row.rowLabel }))
        : (step.candidateTexts.length > 0 ? step.candidateTexts : [step.normalizedText]).map((text) => ({
            text,
            tags: step.tagsEffective,
            label: '',
        }));

    let sawCoveredRow = false;
    for (const row of rows) {
        const selected = selectMatches(
            bindings,
            step.keywordResolved,
            row.text,
            {
                tags: row.tags,
                featureTitle: step.featureName,
                scenarioTitle: step.scenarioName,
            },
            step.argumentTail
        );
        if (selected.matches.length > 0) {
            sawCoveredRow = true;
            continue;
        }
        if (selected.shapeMismatch.length > 0) {
            return {
                summaryKey: 'signature',
                indexedCount,
                outOfScopeMatches: [],
                outOfScopeCount: 0,
                signatureMethods: selected.shapeMismatch.slice(0, UNBOUND_OUT_OF_SCOPE_CAP).map((binding) => binding.methodName),
                rowLabel: row.label || undefined,
            };
        }
        if (selected.outOfScope.length > 0) {
            const need = scopeNeed(selected.outOfScope);
            return {
                summaryKey: 'scopeExcluded',
                indexedCount,
                outOfScopeMatches: selected.outOfScope.slice(0, UNBOUND_OUT_OF_SCOPE_CAP).map(toOutOfScopeMatch),
                outOfScopeCount: selected.outOfScope.length,
                requiredTags: need.hasTitle ? [need.detail] : need.tags,
                rowLabel: row.label || undefined,
            };
        }
        if (row.label) {
            return {
                summaryKey: 'outlineRow',
                indexedCount,
                outOfScopeMatches: [],
                outOfScopeCount: 0,
                rowLabel: row.label,
            };
        }
    }

    if (step.outlineTruncated && sawCoveredRow) {
        return {
            summaryKey: 'outlineLimited',
            indexedCount,
            outOfScopeMatches: [],
            outOfScopeCount: 0,
        };
    }

    return emptyExplanation(indexedCount);
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
        case 'scopeExcluded': {
            const need = (explanation.requiredTags ?? []).join(', ');
            const titled = need.includes('feature "') || need.includes('scenario "');
            return {
                key: titled ? 'unboundScopeDetail' : 'unboundScopeExcluded',
                args: [String(explanation.outOfScopeCount), need],
            };
        }
        case 'signature':
            return {
                key: 'unboundSignature',
                args: [(explanation.signatureMethods ?? []).join(', ')],
            };
        case 'outlineRow':
            return { key: 'unboundOutlineRow', args: [explanation.rowLabel ?? ''] };
        case 'outlineLimited':
            return { key: 'unboundOutlineLimited', args: [] };
        case 'generic':
        default:
            return {
                key: 'unboundGeneric',
                args: [String(explanation.indexedCount)],
            };
    }
}
