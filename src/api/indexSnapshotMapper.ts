/**
 * Maps WorkspaceIndex → GuardianIndexSnapshotDto (read-only, serializable).
 */

import type { FeatureDocument } from '../core/domain/types';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import { PROVIDER_INFO, type BindingProviderId } from '../providers/bindings/types';
import type {
    GuardianBindingDto,
    GuardianFeatureDto,
    GuardianIndexSnapshotDto,
    GuardianProviderDto,
    GuardianTagDto,
} from './types';

function mapFeature(feature: FeatureDocument): GuardianFeatureDto {
    return {
        path: feature.uri.fsPath,
        featureName: feature.featureName,
        featureTags: [...feature.featureTags],
        scenarios: feature.scenarios.map((s) => ({
            name: s.name,
            type: s.type,
            tags: [...s.tags],
            stepCount: s.steps.length,
        })),
    };
}

function collectTags(features: readonly GuardianFeatureDto[]): GuardianTagDto[] {
    const map = new Map<string, { count: number; paths: Set<string> }>();

    for (const feature of features) {
        const tags = new Set<string>([...feature.featureTags]);
        for (const scenario of feature.scenarios) {
            for (const tag of scenario.tags) {
                tags.add(tag);
            }
        }
        for (const tag of tags) {
            const entry = map.get(tag) ?? { count: 0, paths: new Set<string>() };
            entry.count += 1;
            entry.paths.add(feature.path);
            map.set(tag, entry);
        }
    }

    return [...map.entries()]
        .map(([name, { count, paths }]) => ({
            name,
            count,
            featurePaths: [...paths].sort(),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function mapBindings(workspaceIndex: WorkspaceIndex): GuardianBindingDto[] {
    const bindings: GuardianBindingDto[] = [];

    for (const providerId of workspaceIndex.getActiveProviderIds()) {
        for (const binding of workspaceIndex.getBindingsByProvider(providerId)) {
            bindings.push({
                path: binding.uri.fsPath,
                pattern: binding.patternRaw,
                keyword: binding.keyword,
                providerId,
                className: binding.className,
                methodName: binding.methodName,
            });
        }
    }

    return bindings;
}

function mapProviders(workspaceIndex: WorkspaceIndex): GuardianProviderDto[] {
    const providers: GuardianProviderDto[] = [];

    for (const [id, bindingCount] of workspaceIndex.getBindingCountByProvider()) {
        const info = PROVIDER_INFO[id as BindingProviderId];
        providers.push({
            id,
            displayName: info?.displayName ?? id,
            bindingCount,
        });
    }

    return providers.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Build a fresh snapshot DTO (deep copy — safe for consumers).
 */
export function mapWorkspaceToSnapshotDto(workspaceIndex: WorkspaceIndex): GuardianIndexSnapshotDto {
    const features = workspaceIndex.getAllFeatures().map(mapFeature);
    const tags = collectTags(features);
    const stats = workspaceIndex.getStats();

    const dto: GuardianIndexSnapshotDto = {
        indexedAt: workspaceIndex.getData().lastIndexed.toISOString(),
        stats: {
            featureCount: stats.featureCount,
            scenarioCount: features.reduce((n, f) => n + f.scenarios.length, 0),
            stepCount: stats.stepCount,
            tagCount: tags.length,
            bindingCount: stats.bindingCount,
        },
        features,
        bindings: mapBindings(workspaceIndex),
        providers: mapProviders(workspaceIndex),
        tags,
    };

    return JSON.parse(JSON.stringify(dto)) as GuardianIndexSnapshotDto;
}
