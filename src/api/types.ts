/**
 * Guardian Index API v1 — serializable DTOs for extension.exports consumers.
 * @see docs/EXTENSION_API.md
 */

export interface GuardianIndexApiV1 {
    readonly apiVersion: 1;
    readonly isReady: boolean;
    getSnapshot(): GuardianIndexSnapshotDto | null;
    onDidChangeIndex(listener: () => void): import('vscode').Disposable;
    /** API v1.1 — optional; present since Guardian v0.8.3 */
    resolveStep?(featurePath: string, line: number): GuardianStepResolveDto | null;
}

export type GuardianStepMatchStatus = 'bound' | 'unbound' | 'ambiguous';

export interface GuardianStepCandidateDto {
    className: string;
    methodName: string;
    pattern: string;
    providerId?: string;
}

export interface GuardianStepResolveDto {
    featurePath: string;
    line: number;
    keyword: 'Given' | 'When' | 'Then';
    stepText: string;
    status: GuardianStepMatchStatus;
    binding?: {
        path: string;
        pattern: string;
        className: string;
        methodName: string;
        providerId?: string;
    };
    candidateCount?: number;
    candidates?: GuardianStepCandidateDto[];
}

export interface GuardianIndexSnapshotDto {
    indexedAt: string;
    stats: {
        featureCount: number;
        scenarioCount: number;
        stepCount: number;
        tagCount: number;
        bindingCount: number;
    };
    features: GuardianFeatureDto[];
    bindings: GuardianBindingDto[];
    providers: GuardianProviderDto[];
    tags?: GuardianTagDto[];
}

export interface GuardianFeatureDto {
    path: string;
    featureName: string;
    featureTags: string[];
    scenarios: {
        name: string;
        type: 'Scenario' | 'Scenario Outline';
        tags: string[];
        stepCount: number;
    }[];
}

export interface GuardianBindingDto {
    path: string;
    pattern: string;
    keyword: 'Given' | 'When' | 'Then';
    providerId?: string;
    className?: string;
    methodName?: string;
}

export interface GuardianProviderDto {
    id: string;
    displayName: string;
    bindingCount: number;
}

export interface GuardianTagDto {
    name: string;
    count: number;
    featurePaths: string[];
}
