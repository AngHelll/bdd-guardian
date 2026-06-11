/**
 * stepResolve — binding-demo smoke for API v1.1 resolveStep
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { resolveStepAtLine } from '../api/stepResolve';
import { createGuardianIndexApi } from '../api/indexApi';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import { createMockDocument, Uri } from './mocks/vscode';

const ROOT = join(__dirname, '../../samples/binding-demo');
const FEATURE_PATH = join(ROOT, 'Features/sample.feature');

function indexBindingDemo(): WorkspaceIndex {
    const featureText = readFileSync(FEATURE_PATH, 'utf-8');
    const stepsText = readFileSync(join(ROOT, 'StepDefinitions/SampleSteps.cs'), 'utf-8');
    const doc = createMockDocument(featureText, FEATURE_PATH);
    const parsed = parseFeatureDocument(doc as vscode.TextDocument)!;
    const bindings = parseCSharpBindingsFromText(
        stepsText,
        Uri.file(join(ROOT, 'StepDefinitions/SampleSteps.cs')) as vscode.Uri
    );

    const index = new WorkspaceIndex();
    index.setFeature(parsed);
    index.addBindings(bindings, 'csharp-reqnroll');
    index.markIndexed();
    return index;
}

describe('stepResolve API v1.1', () => {
    it('resolves bound step on binding-demo', () => {
        const index = indexBindingDemo();
        const whenStep = index.getAllFeatures()[0].allSteps.find((s) =>
            s.rawText.includes('record a deposit')
        );
        expect(whenStep).toBeDefined();

        const dto = resolveStepAtLine(index, FEATURE_PATH, whenStep!.lineNumber);
        expect(dto).not.toBeNull();
        expect(dto!.status).toBe('bound');
        expect(dto!.binding?.methodName).toBe('WhenIRecordDeposit');
    });

    it('resolves ambiguous Then step (line 53)', () => {
        const index = indexBindingDemo();
        const dto = resolveStepAtLine(index, FEATURE_PATH, 53);
        expect(dto).not.toBeNull();
        expect(dto!.status).toBe('ambiguous');
        expect(dto!.candidateCount).toBe(2);
        expect(dto!.candidates).toHaveLength(2);
    });

    it('returns null for unknown feature path', () => {
        const index = indexBindingDemo();
        expect(resolveStepAtLine(index, '/missing.feature', 0)).toBeNull();
    });

    it('exposes resolveStep on GuardianIndexApiV1 factory', () => {
        const index = indexBindingDemo();
        const api = createGuardianIndexApi(index, { isIndexing: () => false } as never);
        expect(typeof api.resolveStep).toBe('function');

        const dto = api.resolveStep!(FEATURE_PATH, 53);
        expect(dto?.status).toBe('ambiguous');
    });

    it('resolveStep returns null while not ready', () => {
        const index = indexBindingDemo();
        const api = createGuardianIndexApi(index, { isIndexing: () => true } as never);
        expect(api.resolveStep!(FEATURE_PATH, 53)).toBeNull();
    });
});
