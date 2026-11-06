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

    it('Wave B CE optional / alternation / {long} resolve bound', () => {
        const featureText = readFileSync(join(ROOT, 'Features/sample.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'StepDefinitions/SampleSteps.cs'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'Features/sample.feature'));
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parseCSharpBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'StepDefinitions/SampleSteps.cs')) as any
        );

        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });

        const cucumber = parsed.allSteps.find((s) => s.rawText === 'I own 1 cucumber');
        const cucumbers = parsed.allSteps.find((s) => s.rawText === 'I own 2 cucumbers');
        const ateA = parsed.allSteps.find((s) => s.rawText === 'I ate a banana');
        const ateAn = parsed.allSteps.find((s) => s.rawText === 'I ate an apple');
        const balance = parsed.allSteps.find((s) => s.rawText === 'the balance should be 1000');

        expect(resolve(cucumber!).status).toBe('bound');
        expect(resolve(cucumber!).best?.binding.methodName).toBe('GivenIOwnOptionalCucumbers');
        expect(resolve(cucumbers!).status).toBe('bound');
        expect(resolve(ateA!).status).toBe('bound');
        expect(resolve(ateA!).best?.binding.methodName).toBe('WhenIAteAOrAn');
        expect(resolve(ateAn!).status).toBe('bound');
        expect(resolve(balance!).status).toBe('bound');
        expect(resolve(balance!).best?.binding.methodName).toBe('ThenBalanceShouldBe');
    });

    it('Wave v1.11 Scope resolves web/api and unbound without tag', () => {
        const featureText = readFileSync(join(ROOT, 'Features/sample.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'StepDefinitions/SampleSteps.cs'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'Features/sample.feature'));
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parseCSharpBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'StepDefinitions/SampleSteps.cs')) as any
        );

        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });

        const webStep = parsed.allSteps.find(
            (s) => s.rawText === 'I log in with scoped credentials' && s.tagsEffective.includes('@web')
        );
        const apiStep = parsed.allSteps.find(
            (s) => s.rawText === 'I log in with scoped credentials' && s.tagsEffective.includes('@api')
        );
        const bareStep = parsed.allSteps.find(
            (s) =>
                s.rawText === 'I log in with scoped credentials' &&
                !s.tagsEffective.includes('@web') &&
                !s.tagsEffective.includes('@api')
        );

        expect(resolve(webStep!).status).toBe('bound');
        expect(resolve(webStep!).best?.binding.methodName).toBe('LoginWeb');
        expect(resolve(apiStep!).status).toBe('bound');
        expect(resolve(apiStep!).best?.binding.methodName).toBe('LoginApi');
        expect(resolve(bareStep!).status).toBe('unbound');
    });

    it('resolves a Reqnroll {my_version} transformation', () => {
        const featureText = readFileSync(join(ROOT, 'Features/sample.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'StepDefinitions/SampleSteps.cs'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'Features/sample.feature'));
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parseCSharpBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'StepDefinitions/SampleSteps.cs')) as any
        );
        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });
        const step = parsed.allSteps.find((s) => s.rawText === 'I download the release v1.2.3 of the application');
        expect(resolve(step!).status).toBe('bound');
        expect(resolve(step!).best?.binding.methodName).toBe('WhenIDownload');
    });

    it('v1.24 scope, outline rows, and signature resolve on the fidelity fixtures', () => {
        const stepsText = readFileSync(join(ROOT, 'StepDefinitions/FidelitySteps.cs'), 'utf-8');
        const bindings = parseCSharpBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'StepDefinitions/FidelitySteps.cs')) as any
        );
        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });
        const other = parseFeatureDocument(createMockDocument(
            readFileSync(join(ROOT, 'Features/fidelity-v124.feature'), 'utf-8'),
            join(ROOT, 'Features/fidelity-v124.feature')
        ) as any)!;
        const allowed = parseFeatureDocument(createMockDocument(
            readFileSync(join(ROOT, 'Features/fidelity-allowed.feature'), 'utf-8'),
            join(ROOT, 'Features/fidelity-allowed.feature')
        ) as any)!;

        const outside = other.allSteps.find((step) => step.rawText === 'a feature scoped step')!;
        const inside = allowed.allSteps.find((step) => step.rawText === 'a feature scoped step')!;
        const state = other.allSteps.find((step) => step.rawText === 'state is <state>')!;
        const amount = other.allSteps.find((step) => step.rawText === 'amount is 10')!;
        const configs = other.allSteps.filter((step) => step.rawText === 'configuration exists');

        expect(resolve(outside).status).toBe('unbound');
        expect(resolve(inside).status).toBe('bound');
        expect(resolve(inside).best?.binding.methodName).toBe('Scoped');
        expect(resolve(state).status).toBe('bound');
        expect(resolve(state).candidates).toHaveLength(2);
        expect(resolve(amount).status).toBe('bound');
        expect(resolve(amount).candidates).toHaveLength(1);
        expect(resolve(configs[0]).best?.binding.methodName).toBe('WithoutTable');
        expect(resolve(configs[1]).best?.binding.methodName).toBe('WithTable');
    });
});
