/**
 * analyze — resolve steps + orphan bindings → JSON summary.
 */

import { createResolver } from '../core/matching/resolver';
import { listOrphanBindings } from '../core/references/referenceFinder';
import type { Binding, FeatureStep } from '../core/domain/types';
import type { LoadedProject } from './loadProject';
import { toPosixRelative } from './loadProject';
import { CLI_SCHEMA_VERSION } from './discover';

export const DEFAULT_MAX_ITEMS = 50;

export interface AnalyzeStepRow {
    feature: string;
    line: number;
    text: string;
    matchCount?: number;
}

export interface AnalyzeOrphanRow {
    path: string;
    pattern: string;
}

export interface AnalyzeReport {
    schemaVersion: number;
    projectDir: string;
    counts: {
        features: number;
        steps: number;
        bindings: number;
        bound: number;
        unbound: number;
        ambiguous: number;
        orphanBindings: number;
    };
    unbound: AnalyzeStepRow[];
    ambiguous: AnalyzeStepRow[];
    orphans: AnalyzeOrphanRow[];
}

export interface AnalyzeOptions {
    maxItems?: number;
}

function cap<T>(items: T[], max: number): T[] {
    return items.length <= max ? items : items.slice(0, max);
}

export function buildAnalyzeReport(
    project: LoadedProject,
    options: AnalyzeOptions = {}
): AnalyzeReport {
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const bindings: Binding[] = project.bindings.map((b) => b.binding);
    const allSteps: FeatureStep[] = project.features.flatMap((f) => f.allSteps);

    const resolve = createResolver({
        getAllBindings: () => bindings,
        getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
        preferSpecificBinding: false,
    });

    const unbound: AnalyzeStepRow[] = [];
    const ambiguous: AnalyzeStepRow[] = [];
    let bound = 0;

    for (const step of allSteps) {
        const result = resolve(step);
        const feature = toPosixRelative(project.projectDir, step.uri.fsPath);
        const row: AnalyzeStepRow = {
            feature,
            line: step.lineNumber + 1,
            text: step.rawText,
        };
        if (result.status === 'bound') {
            bound++;
        } else if (result.status === 'unbound') {
            unbound.push(row);
        } else if (result.status === 'ambiguous') {
            ambiguous.push({ ...row, matchCount: result.candidates.length });
        }
    }

    const orphanBindings = listOrphanBindings(bindings, allSteps, resolve);
    const orphans: AnalyzeOrphanRow[] = orphanBindings.map((b) => ({
        path: toPosixRelative(project.projectDir, b.uri.fsPath),
        pattern: b.patternRaw,
    }));

    return {
        schemaVersion: CLI_SCHEMA_VERSION,
        projectDir: project.projectDir,
        counts: {
            features: project.features.length,
            steps: allSteps.length,
            bindings: bindings.length,
            bound,
            unbound: unbound.length,
            ambiguous: ambiguous.length,
            orphanBindings: orphans.length,
        },
        unbound: cap(unbound, maxItems),
        ambiguous: cap(ambiguous, maxItems),
        orphans: cap(orphans, maxItems),
    };
}
