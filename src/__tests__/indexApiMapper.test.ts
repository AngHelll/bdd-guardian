import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { mapWorkspaceToSnapshotDto } from '../api/indexSnapshotMapper';
import { createGuardianIndexApi } from '../api/indexApi';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import type { Binding, FeatureDocument } from '../core/domain/types';

function mockFeature(path: string): FeatureDocument {
  const uri = vscode.Uri.file(path);
  return {
    uri,
    featureName: 'Sample',
    featureTags: ['@smoke'],
    backgroundSteps: [],
    scenarios: [
      {
        type: 'Scenario',
        name: 'Ok',
        tags: ['@wip'],
        steps: [],
        examples: [],
        range: new vscode.Range(1, 0, 3, 0),
      },
    ],
    allSteps: [],
  };
}

function mockBinding(path: string): Binding {
  const uri = vscode.Uri.file(path);
  return {
    keyword: 'Given',
    patternRaw: 'a step',
    regex: /a step/,
    className: 'Steps',
    methodName: 'GivenStep',
    uri,
    range: new vscode.Range(0, 0, 0, 20),
    lineNumber: 0,
    signature: 'Steps.GivenStep',
  };
}

describe('Guardian Index API v1', () => {
  it('maps workspace index to serializable snapshot dto', () => {
    const workspaceIndex = new WorkspaceIndex();
    workspaceIndex.setFeature(mockFeature('/ws/Features/sample.feature'));
    workspaceIndex.addBindings([mockBinding('/ws/StepDefinitions/Steps.cs')], 'csharp-reqnroll');
    workspaceIndex.markIndexed();

    const dto = mapWorkspaceToSnapshotDto(workspaceIndex);

    expect(dto.stats.featureCount).toBe(1);
    expect(dto.stats.scenarioCount).toBe(1);
    expect(dto.stats.bindingCount).toBe(1);
    expect(dto.features[0].path).toContain('sample.feature');
    expect(dto.bindings[0].providerId).toBe('csharp-reqnroll');
    expect(dto.providers[0].displayName).toBe('C# Reqnroll');
    expect(dto.tags?.some((t) => t.name === '@smoke')).toBe(true);
  });

  it('exposes isReady and getSnapshot via API factory', () => {
    const workspaceIndex = new WorkspaceIndex();
    const indexManager = { isIndexing: () => false };

    const api = createGuardianIndexApi(workspaceIndex, indexManager as never);
    expect(api.apiVersion).toBe(1);
    expect(api.isReady).toBe(false);
    expect(api.getSnapshot()).toBeNull();

    workspaceIndex.setFeature(mockFeature('/ws/Features/sample.feature'));
    workspaceIndex.markIndexed();

    expect(api.isReady).toBe(true);
    const snapshot = api.getSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.stats.featureCount).toBe(1);
  });

  it('returns null snapshot while indexing', () => {
    const workspaceIndex = new WorkspaceIndex();
    workspaceIndex.setFeature(mockFeature('/ws/Features/sample.feature'));
    workspaceIndex.markIndexed();

    const indexManager = { isIndexing: () => true };
    const api = createGuardianIndexApi(workspaceIndex, indexManager as never);

    expect(api.isReady).toBe(false);
    expect(api.getSnapshot()).toBeNull();
  });
});
