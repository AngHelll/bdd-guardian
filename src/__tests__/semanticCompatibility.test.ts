/**
 * Current Guardian behavior for the two Reqnroll discrepancies.
 * These assertions describe the parser and the resolver as they are.
 * Runtime results are recorded in fixtures/ownership/README.md.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createResolver } from '../core/matching/resolver';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { summarizeSuiteMap } from '../core/map/suiteMap';
import type { Binding, FeatureStep } from '../core/domain/types';
import { createMockDocument, Uri } from './mocks/vscode';

const ALPHA = join(__dirname, 'fixtures/ownership/reqnroll-lab/TestAlpha');
const DEMO = join(__dirname, '../../samples/binding-demo');

function csharp(abs: string): Binding[] {
    return parseCSharpBindingsFromText(readFileSync(abs, 'utf8'), Uri.file(abs) as never);
}

function stepsOf(abs: string): FeatureStep[] {
    const parsed = parseFeatureDocument(createMockDocument(readFileSync(abs, 'utf8'), abs) as never);
    if (!parsed) {
        throw new Error(abs);
    }
    return [...parsed.allSteps];
}

describe('current semantic compatibility', () => {
    const bindings = [
        ...csharp(join(ALPHA, 'Semantics.cs')),
        ...csharp(join(ALPHA, 'PartialMarkedSteps.cs')),
        ...csharp(join(ALPHA, 'PartialLoose.cs')),
    ];
    const steps = stepsOf(join(ALPHA, 'Features/semantics.feature'));
    const resolve = createResolver({
        getAllBindings: () => bindings,
        getBindingsByKeyword: (keyword) => bindings.filter((binding) => binding.keyword === keyword),
        preferSpecificBinding: false,
    });

    function step(text: string): FeatureStep {
        const found = steps.find((item) => item.rawText === text);
        if (!found) {
            throw new Error(text);
        }
        return found;
    }

    function patterns(): string[] {
        return [...new Set(bindings.map((binding) => binding.patternRaw))].sort();
    }

    it('emits a step attribute without checking [Binding], including qualified Reqnroll names', () => {
        const byPattern = (pattern: string) => bindings.find((binding) => binding.patternRaw === pattern);
        expect(patterns()).toEqual([
            'the and step follows given',
            'the and step follows when',
            'the and step only has a given',
            'the but step follows given',
            'the but step follows when',
            'the conjunction anchor is given',
            'the conjunction anchor is when',
            'the given attribute suffix matches',
            'the global given matches',
            'the marked binding fires',
            'the nested binding fires',
            'the outer binding keeps its step',
            'the outer step follows a nested class',
            'the partial loose attribute fires',
            'the partial step is visible',
            'the private nested binding fires',
            'the qualified binding class fires',
            'the qualified given matches',
            'the star step follows given',
            'the star step opens the scenario',
        ]);
        expect(byPattern('the qualified given matches')).toMatchObject({
            keyword: 'Given',
            className: 'QualifiedAttributeSteps',
            methodName: 'GivenTheQualifiedGivenMatches',
        });
        expect(byPattern('the given attribute suffix matches')?.methodName).toBe('GivenTheGivenAttributeSuffixMatches');
        expect(byPattern('the global given matches')?.methodName).toBe('GivenTheGlobalGivenMatches');

        expect(byPattern('the marked binding fires')?.className).toBe('MarkedBindingSteps');
        expect(byPattern('the nested binding fires')?.className).toBe('NestedBinding');
        expect(byPattern('the private nested binding fires')?.className).toBe('PrivateNested');
        expect(byPattern('the outer binding keeps its step')?.className).toBe('HelperWithoutBinding');
        expect(byPattern('the outer step follows a nested class')?.className).toBe('InnerOnly');
        expect(byPattern('the partial step is visible')?.className).toBe('PartialMarkedSteps');
        expect(byPattern('the partial loose attribute fires')?.className).toBe('PartialLooseSteps');
    });

    it('still names a sealed class, and still emits the step when that class has no [Binding]', () => {
        const parsed = parseCSharpBindingsFromText(`
public class First {
}
public sealed class Second {
    [Given("sealed step")]
    public void Sealed() {}
}
`, Uri.file('/sealed.cs') as never);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].className).toBe('Second');
    });

    it('resolves And, But and star through the Gherkin keyword, and leaves a cross-keyword step unbound', () => {
        const marked = resolve(step('the marked binding fires'));
        expect(marked.status).toBe('bound');
        expect(marked.best?.keywordMatched).toBe(true);

        for (const text of [
            'the qualified given matches',
            'the given attribute suffix matches',
            'the global given matches',
        ]) {
            const result = resolve(step(text));
            expect(result.status).toBe('bound');
            expect(result.best?.keywordMatched).toBe(true);
            expect(result.best?.binding.keyword).toBe('Given');
        }

        expect(resolve(step('the outer binding keeps its step')).status).toBe('bound');
        expect(resolve(step('the outer step follows a nested class')).status).toBe('bound');
        expect(resolve(step('the partial loose attribute fires')).status).toBe('bound');
        expect(resolve(step('the partial step is visible')).status).toBe('bound');
        expect(resolve(step('the nested binding fires')).status).toBe('bound');
        expect(resolve(step('the private nested binding fires')).status).toBe('bound');

        const andGiven = step('the and step follows given');
        expect(andGiven.keywordOriginal).toBe('And');
        expect(andGiven.keywordResolved).toBe('Given');
        expect(resolve(andGiven).best?.keywordMatched).toBe(true);

        const butGiven = step('the but step follows given');
        expect(butGiven.keywordOriginal).toBe('But');
        expect(butGiven.keywordResolved).toBe('Given');
        expect(resolve(butGiven).best?.keywordMatched).toBe(true);

        const andWhen = step('the and step follows when');
        expect(andWhen.keywordResolved).toBe('When');
        expect(resolve(andWhen).best?.keywordMatched).toBe(true);
        expect(resolve(andWhen).best?.binding.keyword).toBe('When');

        const butWhen = step('the but step follows when');
        expect(butWhen.keywordResolved).toBe('When');
        expect(resolve(butWhen).best?.keywordMatched).toBe(true);

        const crossed = step('the and step only has a given');
        expect(crossed.keywordOriginal).toBe('And');
        expect(crossed.keywordResolved).toBe('When');
        const crossedResult = resolve(crossed);
        // Was bound with keywordMatched false. The effective keyword has no binding.
        expect(crossedResult.status).toBe('unbound');
        expect(crossedResult.candidates).toHaveLength(0);
        expect(crossedResult.best).toBeUndefined();

        const starAfter = step('the star step follows given');
        expect(starAfter.keywordOriginal).toBe('*');
        expect(starAfter.keywordResolved).toBe('Given');
        expect(resolve(starAfter).best?.keywordMatched).toBe(true);

        const starFirst = step('the star step opens the scenario');
        expect(starFirst.keywordOriginal).toBe('*');
        expect(starFirst.keywordResolved).toBe('Given');
        expect(resolve(starFirst).best?.keywordMatched).toBe(true);
    });

    it('does not use keyword fallback in the binding-demo map', () => {
        const demoBindings = csharp(join(DEMO, 'StepDefinitions/SampleSteps.cs'));
        const demoSteps = stepsOf(join(DEMO, 'Features/sample.feature'));
        const demoResolve = createResolver({
            getAllBindings: () => demoBindings,
            getBindingsByKeyword: (keyword) => demoBindings.filter((binding) => binding.keyword === keyword),
            preferSpecificBinding: false,
        });
        const summary = summarizeSuiteMap({
            steps: demoSteps,
            bindings: demoBindings,
            resolve: demoResolve,
            featureCount: 1,
        });
        expect(summary.counts).toMatchObject({
            steps: 38,
            bindings: 26,
            bound: 25,
            unbound: 1,
            ambiguous: 12,
        });
        const fallback = demoSteps.filter((item) => {
            const result = demoResolve(item);
            return result.candidates.length > 0 && result.candidates.every((candidate) => !candidate.keywordMatched);
        });
        expect(fallback).toEqual([]);
    });
});
