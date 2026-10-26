/**
 * Suite map inventory — bound/unbound/ambiguous/orphan holes (no VS Code UI).
 * Same resolve path as CodeLens; caller supplies the resolver (applyMatchingSettings in the editor).
 */

import { MAX_ORPHAN_BINDING_SCAN } from '../domain/constants';
import type { Binding, FeatureStep } from '../domain/types';
import { explainAmbiguity, type AmbiguityExplanation } from '../matching/ambiguityExplain';
import { explainUnbound, type UnboundExplanation } from '../matching/unboundExplain';
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

/**
 * Whether `counts.orphanBindings` is a measurement.
 * `complete` — the scan finished.
 * `skipped` — the binding count is above the scan limit.
 * `unavailable` — the scan did not run.
 */
export type OrphanScanStatus = 'complete' | 'skipped' | 'unavailable';

export interface SuiteMapCounts {
    readonly features: number;
    readonly steps: number;
    readonly bindings: number;
    readonly bound: number;
    readonly unbound: number;
    readonly ambiguous: number;
    /**
     * Legacy count. It is a measurement only when `orphanScan` is `complete`.
     * Skipped and unavailable scans leave this at 0. That 0 must not be shown as a result.
     */
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
    /** True only when `orphanScan` is `skipped`. */
    readonly orphansSkipped: boolean;
    readonly orphanScan: OrphanScanStatus;
}

export interface OrphanScanPresentation {
    readonly status: OrphanScanStatus;
    /** Present only for a completed scan. */
    readonly orphanBindings?: number;
}

/** Count to display. Omitted when the scan did not produce a measurement. */
export function presentOrphanScan(
    summary: Pick<SuiteMapSummary, 'orphanScan' | 'counts'>
): OrphanScanPresentation {
    if (summary.orphanScan !== 'complete') {
        return { status: summary.orphanScan };
    }
    return {
        status: 'complete',
        orphanBindings: summary.counts.orphanBindings,
    };
}

export interface SummarizeSuiteMapInput {
    readonly steps: readonly FeatureStep[];
    readonly bindings: readonly Binding[];
    readonly resolve: ResolveStep;
    readonly featureCount: number;
    readonly listCap?: number;
    readonly orphanScanMax?: number;
    /** The caller cannot scan. No orphan count is produced. */
    readonly orphanScan?: 'unavailable';
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

/**
 * Why this map hole is still unbound (same `explainUnbound` as hover/Problems).
 * `undefined` if the step is missing or no longer unbound.
 */
export function explainUnboundHole(
    hole: Pick<SuiteMapStepHole, 'uri' | 'lineNumber'>,
    steps: readonly FeatureStep[],
    resolve: ResolveStep,
    bindings: readonly Binding[]
): UnboundExplanation | undefined {
    const step = findHoleStep(hole, steps);
    if (!step) {
        return undefined;
    }
    const result = resolve(step);
    if (result.status !== 'unbound') {
        return undefined;
    }
    return explainUnbound(step, bindings);
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
    const presented = presentOrphanScan(summary);
    const { unbound, ambiguous } = summary.counts;
    return unbound === 0
        && ambiguous === 0
        && presented.status === 'complete'
        && presented.orphanBindings === 0;
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

    const orphanScan: OrphanScanStatus = input.orphanScan === 'unavailable'
        ? 'unavailable'
        : input.bindings.length > orphanScanMax
            ? 'skipped'
            : 'complete';
    const orphansSkipped = orphanScan === 'skipped';
    let orphanHoles: SuiteMapOrphanHole[] = [];
    if (orphanScan === 'complete') {
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
        orphanScan,
    };
}
