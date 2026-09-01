/**
 * Suite map inventory — bound/unbound/ambiguous/orphan holes (no VS Code UI).
 * Same resolve path as CodeLens; caller supplies the resolver (applyMatchingSettings in the editor).
 */

import { MAX_ORPHAN_BINDING_SCAN } from '../domain/constants';
import type { Binding, FeatureStep } from '../domain/types';
import { explainAmbiguity, type AmbiguityExplanation } from '../matching/ambiguityExplain';
import { listOrphanBindings, type ResolveStep } from '../references/referenceFinder';

export const SUITE_MAP_LIST_CAP = 500;

export interface SuiteMapStepHole {
    readonly uri: FeatureStep['uri'];
    readonly lineNumber: number;
    readonly rawText: string;
    readonly matchCount?: number;
}

export interface SuiteMapOrphanHole {
    readonly uri: Binding['uri'];
    readonly lineNumber: number;
    readonly patternRaw: string;
    readonly methodName: string;
}

export interface SuiteMapCounts {
    readonly features: number;
    readonly steps: number;
    readonly bindings: number;
    readonly bound: number;
    readonly unbound: number;
    readonly ambiguous: number;
    readonly orphanBindings: number;
}

export interface SuiteMapSummary {
    readonly counts: SuiteMapCounts;
    readonly unbound: readonly SuiteMapStepHole[];
    readonly ambiguous: readonly SuiteMapStepHole[];
    readonly orphans: readonly SuiteMapOrphanHole[];
    readonly unboundTruncated: number;
    readonly ambiguousTruncated: number;
    readonly orphansTruncated: number;
    readonly orphansSkipped: boolean;
}

export interface SummarizeSuiteMapInput {
    readonly steps: readonly FeatureStep[];
    readonly bindings: readonly Binding[];
    readonly resolve: ResolveStep;
    readonly featureCount: number;
    readonly listCap?: number;
    readonly orphanScanMax?: number;
}

export interface SuiteMapFileGroup<T extends { readonly uri: { readonly fsPath: string } }> {
    readonly uri: T['uri'];
    readonly holes: readonly T[];
}

/** Group listed holes by file. Order of groups = first appearance in `holes` (already uri+line sorted). */
export function groupHolesByUri<T extends { readonly uri: { readonly fsPath: string } }>(
    holes: readonly T[]
): readonly SuiteMapFileGroup<T>[] {
    const groups: { uri: T['uri']; holes: T[] }[] = [];
    const indexByPath = new Map<string, number>();
    for (const hole of holes) {
        const key = hole.uri.fsPath;
        let idx = indexByPath.get(key);
        if (idx === undefined) {
            idx = groups.length;
            indexByPath.set(key, idx);
            groups.push({ uri: hole.uri, holes: [] });
        }
        groups[idx].holes.push(hole);
    }
    return groups;
}

export function findHoleStep(
    hole: Pick<SuiteMapStepHole, 'uri' | 'lineNumber'>,
    steps: readonly FeatureStep[]
): FeatureStep | undefined {
    return steps.find(
        (s) => s.uri.fsPath === hole.uri.fsPath && s.lineNumber === hole.lineNumber
    );
}

/**
 * Why this map hole is still ambiguous (same `explainAmbiguity` as hover/Problems).
 * `undefined` if the step is missing or no longer ambiguous.
 */
export function explainAmbiguousHole(
    hole: Pick<SuiteMapStepHole, 'uri' | 'lineNumber'>,
    steps: readonly FeatureStep[],
    resolve: ResolveStep
): AmbiguityExplanation | undefined {
    const step = findHoleStep(hole, steps);
    if (!step) {
        return undefined;
    }
    const result = resolve(step);
    if (result.status !== 'ambiguous') {
        return undefined;
    }
    return explainAmbiguity(result.candidates);
}

function capList<T>(items: T[], max: number): { listed: T[]; truncated: number } {
    if (items.length <= max) {
        return { listed: items, truncated: 0 };
    }
    return { listed: items.slice(0, max), truncated: items.length - max };
}

function compareStepHoles(a: SuiteMapStepHole, b: SuiteMapStepHole): number {
    const pathCmp = a.uri.fsPath.localeCompare(b.uri.fsPath);
    if (pathCmp !== 0) {
        return pathCmp;
    }
    return a.lineNumber - b.lineNumber;
}

function compareOrphanHoles(a: SuiteMapOrphanHole, b: SuiteMapOrphanHole): number {
    const pathCmp = a.uri.fsPath.localeCompare(b.uri.fsPath);
    if (pathCmp !== 0) {
        return pathCmp;
    }
    return a.lineNumber - b.lineNumber;
}

export function isSuiteMapHealthy(summary: SuiteMapSummary): boolean {
    const { unbound, ambiguous, orphanBindings } = summary.counts;
    return unbound === 0 && ambiguous === 0 && orphanBindings === 0 && !summary.orphansSkipped;
}

export function summarizeSuiteMap(input: SummarizeSuiteMapInput): SuiteMapSummary {
    const listCap = input.listCap ?? SUITE_MAP_LIST_CAP;
    const orphanScanMax = input.orphanScanMax ?? MAX_ORPHAN_BINDING_SCAN;
    const unbound: SuiteMapStepHole[] = [];
    const ambiguous: SuiteMapStepHole[] = [];
    let bound = 0;

    for (const step of input.steps) {
        const result = input.resolve(step);
        if (result.status === 'bound') {
            bound++;
        } else if (result.status === 'unbound') {
            unbound.push({
                uri: step.uri,
                lineNumber: step.lineNumber,
                rawText: step.rawText,
            });
        } else if (result.status === 'ambiguous') {
            ambiguous.push({
                uri: step.uri,
                lineNumber: step.lineNumber,
                rawText: step.rawText,
                matchCount: result.candidates.length,
            });
        }
    }

    unbound.sort(compareStepHoles);
    ambiguous.sort(compareStepHoles);

    const orphansSkipped = input.bindings.length > orphanScanMax;
    let orphanHoles: SuiteMapOrphanHole[] = [];
    if (!orphansSkipped) {
        orphanHoles = listOrphanBindings(input.bindings, input.steps, input.resolve)
            .map((b) => ({
                uri: b.uri,
                lineNumber: b.lineNumber,
                patternRaw: b.patternRaw,
                methodName: b.methodName,
            }))
            .sort(compareOrphanHoles);
    }

    const unboundCap = capList(unbound, listCap);
    const ambiguousCap = capList(ambiguous, listCap);
    const orphansCap = capList(orphanHoles, listCap);

    return {
        counts: {
            features: input.featureCount,
            steps: input.steps.length,
            bindings: input.bindings.length,
            bound,
            unbound: unbound.length,
            ambiguous: ambiguous.length,
            orphanBindings: orphanHoles.length,
        },
        unbound: unboundCap.listed,
        ambiguous: ambiguousCap.listed,
        orphans: orphansCap.listed,
        unboundTruncated: unboundCap.truncated,
        ambiguousTruncated: ambiguousCap.truncated,
        orphansTruncated: orphansCap.truncated,
        orphansSkipped,
    };
}
