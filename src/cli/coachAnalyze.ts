/**
 * coach-analyze — run Coach rules headless → JSON (no quick fixes).
 */

import * as path from 'path';
import { RuleEngine } from '../features/coach/ruleEngine';
import { featureDocumentToGherkinModel } from '../features/coach/featureDocumentAdapter';
import type { LoadedProject } from './loadProject';
import { toPosixRelative, pathsEqual } from './loadProject';
import { CLI_SCHEMA_VERSION } from './discover';
import { DEFAULT_MAX_ITEMS } from './analyze';

export interface CoachFindingRow {
    ruleId: string;
    severity: string;
    featurePath: string;
    line: number;
    message: string;
}

export interface CoachAnalyzeReport {
    schemaVersion: number;
    projectDir: string;
    counts: {
        files: number;
        findings: number;
        byRuleId: Record<string, number>;
    };
    findings: CoachFindingRow[];
}

export interface CoachAnalyzeOptions {
    maxItems?: number;
    /** Relative or absolute path to a single .feature under the project. */
    featurePath?: string;
}

function cap<T>(items: T[], max: number): T[] {
    return items.length <= max ? items : items.slice(0, max);
}

function resolveFeatureAbs(projectDir: string, featurePath: string): string {
    return path.isAbsolute(featurePath)
        ? path.normalize(featurePath)
        : path.normalize(path.join(projectDir, featurePath));
}

/**
 * Run default Coach rules on loaded features (read-only).
 */
export function buildCoachAnalyzeReport(
    project: LoadedProject,
    options: CoachAnalyzeOptions = {}
): CoachAnalyzeReport {
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const engine = new RuleEngine();

    let indices = project.features.map((_, i) => i);
    if (options.featurePath) {
        const target = resolveFeatureAbs(project.projectDir, options.featurePath);
        const idx = project.featurePaths.findIndex((p) => pathsEqual(p, target));
        if (idx < 0) {
            throw new Error(`feature not found under project: ${options.featurePath}`);
        }
        indices = [idx];
    }

    const findings: CoachFindingRow[] = [];
    const byRuleId: Record<string, number> = {};

    for (const i of indices) {
        const doc = project.features[i];
        const featurePath = toPosixRelative(project.projectDir, project.featurePaths[i]);
        const model = featureDocumentToGherkinModel(doc);
        const result = engine.run(model);
        for (const f of result.findings) {
            byRuleId[f.ruleId] = (byRuleId[f.ruleId] ?? 0) + 1;
            findings.push({
                ruleId: f.ruleId,
                severity: f.severity,
                featurePath,
                line: f.line,
                message: f.message,
            });
        }
    }

    return {
        schemaVersion: CLI_SCHEMA_VERSION,
        projectDir: project.projectDir,
        counts: {
            files: indices.length,
            findings: findings.length,
            byRuleId,
        },
        findings: cap(findings, maxItems),
    };
}
