/**
 * Guardian Index API v1 factory — extension.exports surface.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../core/index/indexManager';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import { mapWorkspaceToSnapshotDto } from './indexSnapshotMapper';
import { resolveStepAtLine } from './stepResolve';
import type { GuardianIndexApiV1, GuardianIndexSnapshotDto, GuardianStepResolveDto } from './types';

export function createGuardianIndexApi(
    workspaceIndex: WorkspaceIndex,
    indexManager: IndexManager
): GuardianIndexApiV1 {
    const api: GuardianIndexApiV1 = {
        apiVersion: 1,

        get isReady(): boolean {
            if (indexManager.isIndexing()) {
                return false;
            }
            const lastIndexed = workspaceIndex.getData().lastIndexed.getTime();
            if (lastIndexed <= 0) {
                return false;
            }
            return workspaceIndex.getStats().featureCount > 0;
        },

        getSnapshot(): GuardianIndexSnapshotDto | null {
            if (!api.isReady) {
                return null;
            }
            return mapWorkspaceToSnapshotDto(workspaceIndex);
        },

        onDidChangeIndex(listener: () => void): vscode.Disposable {
            return workspaceIndex.onDidChange(() => listener());
        },

        resolveStep(featurePath: string, line: number): GuardianStepResolveDto | null {
            if (!api.isReady) {
                return null;
            }
            return resolveStepAtLine(workspaceIndex, featurePath, line);
        },
    };

    return api;
}
