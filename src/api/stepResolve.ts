/**
 * resolveStep — maps a feature line to bound / unbound / ambiguous via Guardian resolver.
 */

import * as path from 'path';
import type { FeatureDocument, MatchStatus, ResolveResult } from '../core/domain/types';
import { applyMatchingSettings, createResolver } from '../core/matching';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import type { GuardianStepCandidateDto, GuardianStepResolveDto } from './types';

const MAX_AMBIGUOUS_CANDIDATES = 3;

function findFeatureByPath(workspaceIndex: WorkspaceIndex, featurePath: string): FeatureDocument | undefined {
    const target = path.normalize(featurePath);
    for (const feature of workspaceIndex.getAllFeatures()) {
        if (path.normalize(feature.uri.fsPath) === target) {
            return feature;
        }
    }
    return undefined;
}

function mapCandidates(result: ResolveResult): GuardianStepCandidateDto[] | undefined {
    if (result.status !== 'ambiguous' || result.candidates.length === 0) {
        return undefined;
    }

    return result.candidates.slice(0, MAX_AMBIGUOUS_CANDIDATES).map((c) => ({
        className: c.binding.className,
        methodName: c.binding.methodName,
        pattern: c.binding.patternRaw,
        providerId: undefined,
    }));
}

function mapResolveResult(
    featurePath: string,
    line: number,
    result: ResolveResult
): GuardianStepResolveDto {
    const dto: GuardianStepResolveDto = {
        featurePath,
        line,
        keyword: result.step.keywordResolved,
        stepText: result.step.rawText,
        status: result.status,
    };

    if (result.status === 'bound' && result.best) {
        dto.binding = {
            path: result.best.binding.uri.fsPath,
            pattern: result.best.binding.patternRaw,
            className: result.best.binding.className,
            methodName: result.best.binding.methodName,
        };
    }

    if (result.status === 'ambiguous') {
        dto.candidateCount = result.candidates.length;
        dto.candidates = mapCandidates(result);
    }

    return JSON.parse(JSON.stringify(dto)) as GuardianStepResolveDto;
}

/**
 * Resolve a step at a 0-based line in a feature file using the workspace index.
 */
export function resolveStepAtLine(
    workspaceIndex: WorkspaceIndex,
    featurePath: string,
    line: number
): GuardianStepResolveDto | null {
    const feature = findFeatureByPath(workspaceIndex, featurePath);
    if (!feature) {
        return null;
    }

    const step = feature.allSteps.find((s) => s.lineNumber === line);
    if (!step) {
        return null;
    }

    const deps = applyMatchingSettings({
        getAllBindings: () => workspaceIndex.getAllBindings(),
        getBindingsByKeyword: (keyword) => workspaceIndex.getBindingsByKeyword(keyword),
    });

    const result = createResolver(deps)(step);
    return mapResolveResult(path.normalize(featurePath), line, result);
}

export function isResolvableMatchStatus(status: MatchStatus): boolean {
    return status === 'bound' || status === 'unbound' || status === 'ambiguous';
}
