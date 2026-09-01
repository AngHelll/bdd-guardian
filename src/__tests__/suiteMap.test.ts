/**
 * Suite map inventory — counts and holes match resolver status.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createResolver, type ResolverDependencies } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import {
    summarizeSuiteMap,
    isSuiteMapHealthy,
    groupHolesByUri,
    explainAmbiguousHole,
    SUITE_MAP_LIST_CAP,
} from '../core/map/suiteMap';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { createMockDocument, Uri, Range } from './mocks/vscode';

const ROOT = join(__dirname, '../../samples/binding-demo');

function createBinding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    lineNumber: number,
    filePath = '/test/Steps.cs'
): Binding {
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'TestSteps',
        methodName,
        uri: Uri.file(filePath) as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        signature: `TestSteps.${methodName}`,
        scopeTags: [],
    };
}

function createStep(
    keyword: ResolvedKeyword,
    text: string,
    lineNumber: number,
    filePath = '/test/a.feature'
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text.replace(/\s+/g, ' ').trim(),
        fullText: `${keyword} ${text}`,
        tagsEffective: [],
        uri: Uri.file(filePath) as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        isOutline: false,
        candidateTexts: [text],
    };
}

function resolveFor(bindings: Binding[]) {
    const deps: ResolverDependencies = {
        getAllBindings: () => bindings,
        getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
        preferSpecificBinding: false,
    };
    return createResolver(deps);
}

describe('summarizeSuiteMap', () => {
    it('counts bound, unbound, ambiguous, and orphan holes', () => {
        const used = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
        const orphan = createBinding('Given', 'orphaned unused step', 'OrphanMethod', 20);
        const broad = createBinding('Then', 'the result should be (.*)', 'ThenBroad', 30);
        const specific = createBinding('Then', 'the result should be 15 on the screen', 'ThenSpecific', 40);
        const bindings = [used, orphan, broad, specific];
        const steps = [
            createStep('Given', 'user is logged in', 5),
            createStep('Given', 'no such binding exists', 6),
            createStep('Then', 'the result should be 15 on the screen', 7),
        ];

        const summary = summarizeSuiteMap({
            steps,
            bindings,
            resolve: resolveFor(bindings),
            featureCount: 1,
        });

        expect(summary.counts).toEqual({
            features: 1,
            steps: 3,
            bindings: 4,
            bound: 1,
            unbound: 1,
            ambiguous: 1,
            orphanBindings: 1,
        });
        expect(summary.unbound[0].rawText).toBe('no such binding exists');
        expect(summary.unbound[0].lineNumber).toBe(6);
        expect(summary.ambiguous[0].matchCount).toBe(2);
        expect(summary.orphans[0].methodName).toBe('OrphanMethod');
        expect(summary.orphansSkipped).toBe(false);
        expect(isSuiteMapHealthy(summary)).toBe(false);
    });

    it('is healthy when every step is bound and no orphans', () => {
        const used = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
        const steps = [createStep('Given', 'user is logged in', 5)];
        const summary = summarizeSuiteMap({
            steps,
            bindings: [used],
            resolve: resolveFor([used]),
            featureCount: 1,
        });
        expect(summary.counts.bound).toBe(1);
        expect(summary.counts.unbound).toBe(0);
        expect(isSuiteMapHealthy(summary)).toBe(true);
    });

    it('caps listed holes but keeps full counts', () => {
        const bindings = [createBinding('Given', 'used step', 'Used', 1)];
        const steps = [
            createStep('Given', 'used step', 0),
            ...Array.from({ length: 3 }, (_, i) =>
                createStep('Given', `missing ${i}`, i + 1)
            ),
        ];
        const summary = summarizeSuiteMap({
            steps,
            bindings,
            resolve: resolveFor(bindings),
            featureCount: 1,
            listCap: 2,
        });
        expect(summary.counts.unbound).toBe(3);
        expect(summary.unbound).toHaveLength(2);
        expect(summary.unboundTruncated).toBe(1);
        expect(SUITE_MAP_LIST_CAP).toBe(500);
    });

    it('skips orphan scan above MAX_ORPHAN_BINDING_SCAN without lying empty', () => {
        const used = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
        const steps = [createStep('Given', 'user is logged in', 5)];
        const summary = summarizeSuiteMap({
            steps,
            bindings: [used],
            resolve: resolveFor([used]),
            featureCount: 1,
            orphanScanMax: 0,
        });
        expect(summary.orphansSkipped).toBe(true);
        expect(summary.orphans).toHaveLength(0);
        expect(summary.counts.orphanBindings).toBe(0);
        expect(isSuiteMapHealthy(summary)).toBe(false);
        expect(summary.counts.bound).toBe(1);
    });

    it('binding-demo @v111 untagged scoped login is unbound (same as CodeLens)', () => {
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

        const summary = summarizeSuiteMap({
            steps: parsed.allSteps,
            bindings,
            resolve,
            featureCount: 1,
        });

        const bare = summary.unbound.find(
            (h) => h.rawText === 'I log in with scoped credentials'
        );
        expect(bare).toBeDefined();
        const boundScoped = parsed.allSteps.filter(
            (s) =>
                s.rawText === 'I log in with scoped credentials' &&
                (s.tagsEffective.includes('@web') || s.tagsEffective.includes('@api'))
        );
        expect(boundScoped).toHaveLength(2);
        expect(resolve(boundScoped[0]).status).toBe('bound');
        expect(summary.counts.unbound).toBeGreaterThan(0);
        expect(summary.counts.bound).toBeGreaterThan(0);
    });
});

describe('groupHolesByUri', () => {
    it('returns an empty list for no holes', () => {
        expect(groupHolesByUri([])).toEqual([]);
    });

    it('keeps a singleton file group (does not flatten)', () => {
        const hole = {
            uri: Uri.file('/test/a.feature') as { fsPath: string },
            lineNumber: 4,
            rawText: 'only one',
        };
        const groups = groupHolesByUri([hole]);
        expect(groups).toHaveLength(1);
        expect(groups[0].holes).toEqual([hole]);
        expect(groups[0].uri).toBe(hole.uri);
    });

    it('groups multiple files in first-seen order and preserves line order', () => {
        const a1 = {
            uri: Uri.file('/ws/login.feature') as { fsPath: string },
            lineNumber: 2,
            rawText: 'login a',
        };
        const b1 = {
            uri: Uri.file('/ws/cart.feature') as { fsPath: string },
            lineNumber: 8,
            rawText: 'cart',
        };
        const a2 = {
            uri: Uri.file('/ws/login.feature') as { fsPath: string },
            lineNumber: 10,
            rawText: 'login b',
        };
        const groups = groupHolesByUri([a1, b1, a2]);
        expect(groups).toHaveLength(2);
        expect(groups[0].holes.map((h) => h.rawText)).toEqual(['login a', 'login b']);
        expect(groups[1].holes.map((h) => h.rawText)).toEqual(['cart']);
    });
});

describe('explainAmbiguousHole', () => {
    const used = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
    const broad = createBinding('Then', 'the result should be (.*)', 'ThenBroad', 30);
    const specific = createBinding('Then', 'the result should be 15 on the screen', 'ThenSpecific', 40);
    const bindings = [used, broad, specific];
    const steps = [
        createStep('Given', 'user is logged in', 5),
        createStep('Given', 'no such binding exists', 6),
        createStep('Then', 'the result should be 15 on the screen', 7),
    ];
    const resolve = resolveFor(bindings);

    it('returns an explanation when the hole is still ambiguous', () => {
        const hole = { uri: steps[2].uri, lineNumber: 7, rawText: steps[2].rawText };
        const explanation = explainAmbiguousHole(hole, steps, resolve);
        expect(explanation).toBeDefined();
        expect(explanation?.summaryKey).toBeTruthy();
        expect(explanation?.matchCount).toBe(2);
    });

    it('returns undefined for an unbound hole', () => {
        const hole = { uri: steps[1].uri, lineNumber: 6, rawText: steps[1].rawText };
        expect(explainAmbiguousHole(hole, steps, resolve)).toBeUndefined();
    });

    it('returns undefined for a bound hole', () => {
        const hole = { uri: steps[0].uri, lineNumber: 5, rawText: steps[0].rawText };
        expect(explainAmbiguousHole(hole, steps, resolve)).toBeUndefined();
    });

    it('returns undefined when the step is missing', () => {
        const hole = { uri: steps[0].uri, lineNumber: 99, rawText: 'ghost' };
        expect(explainAmbiguousHole(hole, steps, resolve)).toBeUndefined();
    });
});
