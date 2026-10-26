/**
 * Ownership fixtures E1–E8.
 * Assertions lock the current resolver. Runtime expectations live in
 * fixtures/ownership/README.md and are not asserted here.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createResolver } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { parseJsCucumberBindingsFromText } from '../core/parsing/jsCucumberBindingParser';
import { parseGoGodogBindingsFromText } from '../core/parsing/goGodogBindingParser';
import { presentOrphanScan, SUITE_MAP_LIST_CAP, summarizeSuiteMap } from '../core/map/suiteMap';
import { listOrphanBindings } from '../core/references/referenceFinder';
import { MAX_ORPHAN_BINDING_SCAN } from '../core/domain/constants';
import type { Binding, FeatureDocument, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { createMockDocument, Uri, Range } from './mocks/vscode';

const ROOT = join(__dirname, 'fixtures/ownership');
const LAB = join(ROOT, 'reqnroll-lab');
const DEMO = join(__dirname, '../../samples/binding-demo');

function feature(abs: string): FeatureDocument {
    const text = readFileSync(abs, 'utf8');
    const parsed = parseFeatureDocument(createMockDocument(text, abs) as never);
    if (!parsed) {
        throw new Error(`feature did not parse: ${abs}`);
    }
    return parsed;
}

function csharp(abs: string): Binding[] {
    return parseCSharpBindingsFromText(readFileSync(abs, 'utf8'), Uri.file(abs) as never);
}

function suite(docs: readonly FeatureDocument[], bindings: readonly Binding[]) {
    const steps = docs.flatMap((doc) => [...doc.allSteps]);
    const resolve = createResolver({
        getAllBindings: () => bindings,
        getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
        preferSpecificBinding: false,
    });
    const summary = summarizeSuiteMap({
        steps,
        bindings,
        resolve,
        featureCount: docs.length,
    });
    return { steps, bindings, resolve, summary };
}

function one(
    steps: readonly FeatureStep[],
    text: string,
    pathIncludes: string
): FeatureStep {
    const found = steps.filter(
        (step) => step.rawText === text && step.uri.fsPath.includes(pathIncludes)
    );
    expect(found).toHaveLength(1);
    return found[0];
}

describe('ownership fixtures — current resolver', () => {
    it('E1 pools two folders with the same pattern into ambiguous, and each folder alone is bound', () => {
        const e1 = join(ROOT, 'e1-duplicate-pattern');
        expect(existsSync(join(e1, 'project-a', 'project-a.csproj'))).toBe(false);
        expect(existsSync(join(e1, 'project-b', 'project-b.csproj'))).toBe(false);

        const featureA = join(e1, 'project-a/Features/ping.feature');
        const featureB = join(e1, 'project-b/Features/ping.feature');
        const stepsA = join(e1, 'project-a/Steps/PingSteps.cs');
        const stepsB = join(e1, 'project-b/Steps/PingSteps.cs');

        const alone = suite([feature(featureA)], csharp(stepsA));
        const stepA = one(alone.steps, 'I ping 3', 'project-a');
        expect(alone.resolve(stepA).status).toBe('bound');
        expect(alone.resolve(stepA).best?.binding.methodName).toBe('GivenIPingFromA');
        expect(alone.summary.counts).toMatchObject({ bound: 1, unbound: 0, ambiguous: 0, orphanBindings: 0 });
        expect(alone.summary.orphansSkipped).toBe(false);

        const pooled = suite([feature(featureA), feature(featureB)], [...csharp(stepsA), ...csharp(stepsB)]);
        for (const folder of ['project-a', 'project-b']) {
            const step = one(pooled.steps, 'I ping 3', folder);
            const result = pooled.resolve(step);
            expect(result.status).toBe('ambiguous');
            expect(result.candidates.map((c) => c.binding.methodName).sort()).toEqual([
                'GivenIPingFromA',
                'GivenIPingFromB',
            ]);
            expect(new Set(result.candidates.map((c) => c.binding.uri.fsPath)).size).toBe(2);
        }
        expect(pooled.summary.counts).toMatchObject({
            bound: 0,
            unbound: 0,
            ambiguous: 2,
            orphanBindings: 0,
        });
        expect(pooled.summary.orphansSkipped).toBe(false);
    });

    it('E2 marks two compatible bindings in one file ambiguous, and preferSpecificBinding picks the numeric pattern', () => {
        const overlapFeature = join(LAB, 'TestAlpha/Features/overlap.feature');
        const overlapSteps = join(LAB, 'TestAlpha/Steps.cs');
        const loaded = suite([feature(overlapFeature)], csharp(overlapSteps).filter((b) => b.patternRaw.includes('entered')));
        const step = one(loaded.steps, 'I have entered 100 into the calculator', 'overlap.feature');
        const result = loaded.resolve(step);
        expect(result.status).toBe('ambiguous');
        expect(result.candidates.map((c) => c.binding.methodName).sort()).toEqual([
            'GivenIHaveEnteredAnything',
            'GivenIHaveEnteredNumeric',
        ]);
        expect(new Set(result.candidates.map((c) => c.binding.uri.fsPath)).size).toBe(1);

        const prefer = createResolver({
            getAllBindings: () => loaded.bindings,
            getBindingsByKeyword: (kw) => loaded.bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: true,
        })(step);
        expect(prefer.status).toBe('bound');
        expect(prefer.best?.binding.methodName).toBe('GivenIHaveEnteredNumeric');
    });

    it('E3 leaves a feature with no bindings unbound and does not invent orphans', () => {
        const loaded = suite([feature(join(ROOT, 'e3-no-bindings/lonely.feature'))], []);
        expect(loaded.summary.counts).toMatchObject({
            features: 1,
            steps: 3,
            bindings: 0,
            bound: 0,
            unbound: 3,
            ambiguous: 0,
            orphanBindings: 0,
        });
        expect(loaded.summary.orphansSkipped).toBe(false);
        expect(loaded.steps.map((s) => loaded.resolve(s).status)).toEqual(['unbound', 'unbound', 'unbound']);
    });

    it('E4 binds two features to one shared source file', () => {
        const shared = join(LAB, 'BindingLib/SharedSteps.cs');
        const loaded = suite(
            [
                feature(join(LAB, 'TestAlpha/Features/shared.feature')),
                feature(join(LAB, 'TestBeta/Features/shared.feature')),
            ],
            csharp(shared)
        );
        expect(loaded.bindings).toHaveLength(1);
        for (const folder of ['TestAlpha', 'TestBeta']) {
            const step = one(loaded.steps, 'the shared clock shows 9', folder);
            const result = loaded.resolve(step);
            expect(result.status).toBe('bound');
            expect(result.best?.binding.methodName).toBe('GivenTheSharedClockShows');
            expect(result.best?.binding.uri.fsPath).toContain('BindingLib');
        }
        expect(loaded.summary.counts).toMatchObject({ bound: 2, unbound: 0, ambiguous: 0, orphanBindings: 0 });
        expect(loaded.summary.orphansSkipped).toBe(false);
    });

    it('E5 keeps non-overlapping Godog and Cucumber.js steps bound in one pool', () => {
        const godogFeature = feature(join(ROOT, 'e5-frameworks/godog/features/godogs.feature'));
        const jsFeature = feature(join(ROOT, 'e5-frameworks/cucumber/features/basket.feature'));
        const godogSteps = parseGoGodogBindingsFromText(
            readFileSync(join(ROOT, 'e5-frameworks/godog/godogs_test.go'), 'utf8'),
            Uri.file(join(ROOT, 'e5-frameworks/godog/godogs_test.go')) as never
        );
        const jsSteps = parseJsCucumberBindingsFromText(
            readFileSync(join(ROOT, 'e5-frameworks/cucumber/steps.js'), 'utf8'),
            Uri.file(join(ROOT, 'e5-frameworks/cucumber/steps.js')) as never
        );
        const loaded = suite([godogFeature, jsFeature], [...godogSteps, ...jsSteps]);
        expect(loaded.bindings.map((b) => b.methodName).sort()).toEqual(['Given(...)', 'thereAreGodogs']);
        expect(loaded.summary.counts).toMatchObject({ bound: 2, unbound: 0, ambiguous: 0, orphanBindings: 0 });
        expect(loaded.summary.orphansSkipped).toBe(false);
        expect(loaded.resolve(one(loaded.steps, 'there are 3 godogs', 'godogs.feature')).status).toBe('bound');
        expect(loaded.resolve(one(loaded.steps, 'the js stack has a basket', 'basket.feature')).status).toBe('bound');
    });

    it('E6 keeps the shared file bound and the copied pattern ambiguous when every lab file is pooled', () => {
        const alphaCsproj = readFileSync(join(LAB, 'TestAlpha/TestAlpha.csproj'), 'utf8');
        const betaCsproj = readFileSync(join(LAB, 'TestBeta/TestBeta.csproj'), 'utf8');
        expect(alphaCsproj).toContain('BindingLib.csproj');
        expect(betaCsproj).toContain('BindingLib.csproj');
        expect(alphaCsproj).not.toContain('TestBeta');
        expect(betaCsproj).not.toContain('TestAlpha');
        expect(readFileSync(join(LAB, 'TestAlpha/reqnroll.json'), 'utf8')).toContain('BindingLib');
        expect(readFileSync(join(LAB, 'TestBeta/reqnroll.json'), 'utf8')).toContain('BindingLib');

        const csFiles = [
            join(LAB, 'BindingLib/SharedSteps.cs'),
            join(LAB, 'TestAlpha/Steps.cs'),
            join(LAB, 'TestBeta/Steps.cs'),
        ];
        const featureFiles = [
            'TestAlpha/Features/shared.feature',
            'TestBeta/Features/shared.feature',
            'TestAlpha/Features/ping.feature',
            'TestBeta/Features/ping.feature',
            'TestAlpha/Features/overlap.feature',
            'TestAlpha/Features/keyword.feature',
            'TestAlpha/Features/loose.feature',
            'TestAlpha/Features/scope.feature',
        ].map((rel) => join(LAB, rel));

        const loaded = suite(featureFiles.map(feature), csFiles.flatMap(csharp));
        const sharedA = loaded.resolve(one(loaded.steps, 'the shared clock shows 9', 'TestAlpha'));
        const sharedB = loaded.resolve(one(loaded.steps, 'the shared clock shows 9', 'TestBeta'));
        expect(sharedA.status).toBe('bound');
        expect(sharedB.status).toBe('bound');
        expect(sharedA.best?.binding.methodName).toBe('GivenTheSharedClockShows');

        const pingA = loaded.resolve(one(loaded.steps, 'I ping 3', 'TestAlpha'));
        expect(pingA.status).toBe('ambiguous');
        expect(pingA.candidates.map((c) => c.binding.methodName).sort()).toEqual([
            'GivenIPingFromAlpha',
            'GivenIPingFromBeta',
        ]);

        const overlap = loaded.resolve(one(loaded.steps, 'I have entered 100 into the calculator', 'overlap.feature'));
        expect(overlap.status).toBe('ambiguous');

        const loose = loaded.bindings.find((b) => b.methodName === 'GivenTheLooseAttributeFires');
        expect(loose).toBeDefined();
        const looseStep = loaded.resolve(one(loaded.steps, 'the loose attribute fires', 'loose.feature'));
        expect(looseStep.status).toBe('bound');
        expect(looseStep.best?.binding.methodName).toBe('GivenTheLooseAttributeFires');

        expect(loaded.summary.orphansSkipped).toBe(false);
        // The When no longer consumes GivenThePumpIsPrimed, so that binding is unused.
        expect(loaded.summary.counts.orphanBindings).toBe(1);
        expect(loaded.summary.orphans.map((orphan) => orphan.methodName)).toEqual([
            'GivenThePumpIsPrimed',
        ]);
        expect(loaded.summary.counts.steps).toBe(loaded.summary.counts.bound
            + loaded.summary.counts.unbound
            + loaded.summary.counts.ambiguous);
    });

    it('E7 binds tag scopes inside one file and leaves the untagged step unbound', () => {
        const loaded = suite(
            [feature(join(LAB, 'TestAlpha/Features/scope.feature'))],
            csharp(join(LAB, 'TestAlpha/Steps.cs')).filter((b) => b.patternRaw === 'I log in with scoped credentials')
        );
        const web = loaded.steps.find((s) => s.tagsEffective.includes('@web'));
        const api = loaded.steps.find((s) => s.tagsEffective.includes('@api'));
        const bare = loaded.steps.find(
            (s) => !s.tagsEffective.includes('@web') && !s.tagsEffective.includes('@api')
        );
        expect(loaded.resolve(web!).status).toBe('bound');
        expect(loaded.resolve(web!).best?.binding.methodName).toBe('LoginWeb');
        expect(loaded.resolve(api!).status).toBe('bound');
        expect(loaded.resolve(api!).best?.binding.methodName).toBe('LoginApi');
        expect(loaded.resolve(bare!).status).toBe('unbound');
        expect(loaded.summary.counts).toMatchObject({ bound: 2, unbound: 1, ambiguous: 0 });
        expect(loaded.summary.orphansSkipped).toBe(false);
    });

    it('E6 keyword step stays unbound when the only pattern is a different keyword', () => {
        // Was bound with keywordMatched false via the resolver fallback.
        const loaded = suite(
            [feature(join(LAB, 'TestAlpha/Features/keyword.feature'))],
            csharp(join(LAB, 'TestAlpha/Steps.cs')).filter((b) => b.patternRaw === 'the pump is primed')
        );
        const step = one(loaded.steps, 'the pump is primed', 'keyword.feature');
        expect(step.keywordOriginal).toBe('When');
        expect(step.keywordResolved).toBe('When');
        const result = loaded.resolve(step);
        expect(result.status).toBe('unbound');
        expect(result.candidates).toHaveLength(0);
        expect(result.best).toBeUndefined();
    });

    it('E8 reports zero orphans when the scan is skipped, and finds the unused binding when the scan runs', () => {
        const bindings: Binding[] = [];
        for (let i = 0; i < MAX_ORPHAN_BINDING_SCAN + 1; i++) {
            const pattern = `synthetic binding number ${i}`;
            bindings.push({
                keyword: 'Given',
                patternRaw: pattern,
                regex: compileBindingRegex(pattern)!,
                className: 'Synthetic',
                methodName: `M${i}`,
                uri: Uri.file(`/synthetic/Steps${i}.cs`) as never,
                range: new Range(0, 0, 0, 10) as never,
                lineNumber: 0,
                signature: `Synthetic.M${i}`,
                scopeTags: [],
            });
        }
        const unused = bindings[bindings.length - 1];
        const used = bindings[0];
        const step: FeatureStep = {
            keywordOriginal: 'Given',
            keywordResolved: 'Given' as ResolvedKeyword,
            rawText: used.patternRaw,
            normalizedText: used.patternRaw,
            fullText: `Given ${used.patternRaw}`,
            tagsEffective: [],
            uri: Uri.file('/synthetic/a.feature') as never,
            range: new Range(1, 0, 1, 10) as never,
            lineNumber: 1,
            isOutline: false,
            candidateTexts: [used.patternRaw],
        };
        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });
        const skipped = summarizeSuiteMap({
            steps: [step],
            bindings,
            resolve,
            featureCount: 1,
        });
        expect(bindings.length).toBe(MAX_ORPHAN_BINDING_SCAN + 1);
        expect(skipped.orphansSkipped).toBe(true);
        expect(skipped.orphanScan).toBe('skipped');
        expect(skipped.counts.orphanBindings).toBe(0);
        expect(presentOrphanScan(skipped)).toEqual({ status: 'skipped' });
        expect(skipped.orphans).toHaveLength(0);
        expect(skipped.counts.bound).toBe(1);

        const exact = summarizeSuiteMap({
            steps: [step],
            bindings: bindings.slice(0, MAX_ORPHAN_BINDING_SCAN),
            resolve,
            featureCount: 1,
        });
        expect(exact.orphanScan).toBe('complete');
        expect(exact.counts.orphanBindings).toBe(MAX_ORPHAN_BINDING_SCAN - 1);
        expect(exact.orphans).toHaveLength(SUITE_MAP_LIST_CAP);
        expect(exact.orphansTruncated).toBe(MAX_ORPHAN_BINDING_SCAN - 1 - SUITE_MAP_LIST_CAP);

        const complete = summarizeSuiteMap({
            steps: [step],
            bindings,
            resolve,
            featureCount: 1,
            orphanScanMax: bindings.length,
        });
        expect(complete.orphansSkipped).toBe(false);
        expect(complete.orphanScan).toBe('complete');
        expect(complete.counts.orphanBindings).toBe(MAX_ORPHAN_BINDING_SCAN);
        expect(complete.orphans).toHaveLength(SUITE_MAP_LIST_CAP);
        expect(complete.orphansTruncated).toBe(MAX_ORPHAN_BINDING_SCAN - SUITE_MAP_LIST_CAP);
        const scanned = listOrphanBindings(bindings, [step], resolve);
        expect(scanned).toHaveLength(MAX_ORPHAN_BINDING_SCAN);
        expect(scanned.some((b) => b.methodName === unused.methodName)).toBe(true);
    });

    it('does not change binding-demo classification', () => {
        const loaded = suite(
            [feature(join(DEMO, 'Features/sample.feature'))],
            csharp(join(DEMO, 'StepDefinitions/SampleSteps.cs'))
        );
        expect(loaded.summary.counts).toMatchObject({
            features: 1,
            steps: 38,
            bindings: 26,
            bound: 25,
            unbound: 1,
            ambiguous: 12,
            orphanBindings: 2,
        });
        expect(loaded.summary.orphansSkipped).toBe(false);
    });
});
