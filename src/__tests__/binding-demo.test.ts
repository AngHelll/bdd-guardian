/**
 * binding-demo sample — UI matching smoke (Scenario + Examples after steps)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { createResolver } from '../core/matching/resolver';
import { createMockDocument, Uri } from './mocks/vscode';
import { getStepAtPosition } from '../core/references/stepContext';

const ROOT = join(__dirname, '../../samples/binding-demo');

describe('binding-demo sample', () => {
    it('expands Scenario+Examples deposit steps and resolves bound', () => {
        const featureText = readFileSync(join(ROOT, 'Features/sample.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'StepDefinitions/SampleSteps.cs'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'Features/sample.feature'));
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parseCSharpBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'StepDefinitions/SampleSteps.cs')) as any
        );

        const whenStep = parsed.allSteps.find((s) => s.rawText.includes('record a deposit'));
        const thenStep = parsed.allSteps.find((s) => s.rawText.includes('logged amount'));

        expect(whenStep?.candidateTexts).toContain('I record a deposit of 100 dollars');
        expect(thenStep?.candidateTexts).toContain('the logged amount should be 100');

        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });

        expect(resolve(whenStep!).status).toBe('bound');
        expect(resolve(whenStep!).best?.binding.methodName).toBe('WhenIRecordDeposit');
        expect(resolve(thenStep!).status).toBe('bound');
        expect(resolve(thenStep!).best?.binding.methodName).toBe('ThenLoggedAmount');
    });

    it('ambiguous Then step has exactly two unique bindings (no provider duplicate)', () => {
        const featureText = readFileSync(join(ROOT, 'Features/sample.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'StepDefinitions/SampleSteps.cs'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'Features/sample.feature'));
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parseCSharpBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'StepDefinitions/SampleSteps.cs')) as any
        );

        const thenStep = parsed.allSteps.find((s) => s.rawText === 'the result should be 15 on the screen');
        expect(thenStep).toBeDefined();

        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });

        const result = resolve(thenStep!);
        expect(result.status).toBe('ambiguous');
        expect(result.candidates).toHaveLength(2);
    });

    it('getStepAtPosition expands Then deposit step at editor line 61 (index 60)', () => {
        const featureText = readFileSync(join(ROOT, 'Features/sample.feature'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'Features/sample.feature'));
        const step = getStepAtPosition(doc as any, { line: 60, character: 0 } as any);
        expect(step?.rawText).toBe('the logged amount should be <amount>');
        expect(step?.candidateTexts).toContain('the logged amount should be 100');
    });
});
