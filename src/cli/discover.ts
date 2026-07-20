/**
 * discover — JSON inventory of features + bindings.
 */

import type { LoadedProject } from './loadProject';
import { toPosixRelative } from './loadProject';

export const CLI_SCHEMA_VERSION = 1;

export interface DiscoverFeatureRow {
    path: string;
    stepCount: number;
}

export interface DiscoverBindingRow {
    path: string;
    pattern: string;
    providerId: string;
}

export interface DiscoverReport {
    schemaVersion: number;
    projectDir: string;
    features: DiscoverFeatureRow[];
    bindings: DiscoverBindingRow[];
    providersDetected: string[];
}

export function buildDiscoverReport(project: LoadedProject): DiscoverReport {
    const features = project.features.map((f, i) => ({
        path: toPosixRelative(project.projectDir, project.featurePaths[i] ?? f.uri.fsPath),
        stepCount: f.allSteps.length,
    }));

    const bindings = project.bindings.map(({ binding, providerId }) => ({
        path: toPosixRelative(project.projectDir, binding.uri.fsPath),
        pattern: binding.patternRaw,
        providerId,
    }));

    return {
        schemaVersion: CLI_SCHEMA_VERSION,
        projectDir: project.projectDir,
        features,
        bindings,
        providersDetected: [...project.providersDetected],
    };
}
