/**
 * resolve-step — single step at 0-based line → JSON (Index API parity).
 */

import * as path from 'path';
import { createResolver } from '../core/matching/resolver';
import {
    explainAmbiguity,
    ambiguityI18n,
    type AmbiguityI18nKey,
} from '../core/matching/ambiguityExplain';
import {
    explainUnbound,
    unboundI18n,
    type UnboundI18nKey,
} from '../core/matching/unboundExplain';
import type { Binding, ResolveResult } from '../core/domain/types';
import type { LoadedProject } from './loadProject';
import { toPosixRelative, pathsEqual } from './loadProject';
import { CLI_SCHEMA_VERSION } from './discover';

export type ResolveStepStatus = 'bound' | 'unbound' | 'ambiguous' | 'no_step';

export interface ResolveStepMatchRow {
    path: string;
    line: number;
    pattern: string;
    score: number;
    methodName: string;
}

export interface ResolveStepReport {
    schemaVersion: number;
    status: ResolveStepStatus;
    featurePath: string;
    line: number;
    stepText: string | null;
    matches: ResolveStepMatchRow[];
    why: string | null;
}

/** English why strings (CLI has no VS Code locale). */
const AMBIGUITY_WHY_EN: Record<AmbiguityI18nKey, string> = {
    ambiguitySamePattern: 'Multiple bindings share pattern "{0}"',
    ambiguityScoreTie: 'Top matches have the same score ({0})',
    ambiguityBroadVsSpecific: 'Broad pattern "{0}" overlaps more specific "{1}"',
    ambiguityGeneric: '{0} bindings match this step',
};

const UNBOUND_WHY_EN: Record<UnboundI18nKey, string> = {
    unboundEmptyIndex: 'No step bindings are indexed',
    unboundScopeExcluded:
        'Pattern matches {0} scoped binding(s); none apply to this step\'s tags (need {1})',
    unboundGeneric: '{0} bindings indexed; none match this step',
};

function interpolateWhy(template: string, args: readonly string[]): string {
    return template.replace(/\{(\d+)\}/g, (_, i: string) => args[Number(i)] ?? '');
}

function formatWhyEn(result: ResolveResult, bindings: readonly Binding[]): string | null {
    if (result.status === 'ambiguous') {
        const { key, args } = ambiguityI18n(explainAmbiguity(result.candidates));
        return interpolateWhy(AMBIGUITY_WHY_EN[key], args);
    }
    if (result.status === 'unbound') {
        const { key, args } = unboundI18n(explainUnbound(result.step, bindings));
        return interpolateWhy(UNBOUND_WHY_EN[key], args);
    }
    return null;
}

function resolveFeatureAbs(projectDir: string, featurePath: string): string {
    return path.isAbsolute(featurePath)
        ? path.normalize(featurePath)
        : path.normalize(path.join(projectDir, featurePath));
}

function findFeatureIndex(project: LoadedProject, featureAbs: string): number {
    return project.featurePaths.findIndex((p) => pathsEqual(p, featureAbs));
}

function mapMatches(project: LoadedProject, result: ResolveResult): ResolveStepMatchRow[] {
    const list =
        result.status === 'bound' && result.best
            ? [result.best]
            : result.status === 'ambiguous'
              ? [...result.candidates]
              : [];

    return list.map((c) => ({
        path: toPosixRelative(project.projectDir, c.binding.uri.fsPath),
        line: c.binding.lineNumber,
        pattern: c.binding.patternRaw,
        score: c.score,
        methodName: c.binding.methodName,
    }));
}

/**
 * Resolve one step by 0-based line within a feature under the loaded project.
 */
export function buildResolveStepReport(
    project: LoadedProject,
    featurePath: string,
    line: number
): ResolveStepReport {
    const featureAbs = resolveFeatureAbs(project.projectDir, featurePath);
    const rel = toPosixRelative(project.projectDir, featureAbs);
    const empty = (status: ResolveStepStatus): ResolveStepReport => ({
        schemaVersion: CLI_SCHEMA_VERSION,
        status,
        featurePath: rel,
        line,
        stepText: null,
        matches: [],
        why: null,
    });

    if (!Number.isInteger(line) || line < 0) {
        throw new Error(`line must be a non-negative integer (0-based), got: ${line}`);
    }

    const idx = findFeatureIndex(project, featureAbs);
    if (idx < 0) {
        return empty('no_step');
    }

    const feature = project.features[idx];
    const step = feature.allSteps.find((s) => s.lineNumber === line);
    if (!step) {
        return empty('no_step');
    }

    const bindings: Binding[] = project.bindings.map((b) => b.binding);
    const resolve = createResolver({
        getAllBindings: () => bindings,
        getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
        preferSpecificBinding: false,
    });
    const result = resolve(step);

    return {
        schemaVersion: CLI_SCHEMA_VERSION,
        status: result.status,
        featurePath: rel,
        line,
        stepText: step.rawText,
        matches: mapMatches(project, result),
        why: formatWhyEn(result, bindings),
    };
}
