/**
 * Tests for Find All References core logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createResolver, ResolverDependencies } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import {
    findReferencesForBinding,
    findReferencesForStep,
    stepLocationKey,
} from '../core/references';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { Uri, Range } from './mocks/vscode';

function createBinding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    lineNumber: number,
    uriPath: string = '/test/Steps.cs'
): Binding {
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'TestSteps',
        methodName,
        uri: Uri.file(uriPath) as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        signature: `TestSteps.${methodName}`,
    };
}

function createStep(
    keyword: ResolvedKeyword,
    text: string,
    lineNumber: number,
    uriPath: string = '/test/a.feature',
    scenarioName?: string
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text.replace(/\s+/g, ' ').trim(),
        fullText: `${keyword} ${text}`,
        tagsEffective: [],
        uri: Uri.file(uriPath) as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        scenarioName,
        isOutline: false,
        candidateTexts: [text],
    };
}

describe('referenceFinder', () => {
    let resolve: ReturnType<typeof createResolver>;
    let bindingLogin: Binding;
    let bindingInit: Binding;

    beforeEach(() => {
        bindingLogin = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
        bindingInit = createBinding('Given', 'the app is ready', 'AppIsReady', 20);

        const bindings = [bindingLogin, bindingInit];
        const deps: ResolverDependencies = {
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter(b => b.keyword === kw),
        };
        resolve = createResolver(deps);
    });

    describe('findReferencesForBinding', () => {
        it('returns all feature steps that resolve to the binding', () => {
            const steps = [
                createStep('Given', 'user is logged in', 5, '/test/a.feature', 'S1'),
                createStep('Given', 'user is logged in', 8, '/test/b.feature', 'S2'),
                createStep('Given', 'the app is ready', 12, '/test/a.feature', 'S3'),
            ];

            const refs = findReferencesForBinding(bindingLogin, steps, resolve);
            expect(refs).toHaveLength(2);
            expect(refs.map(s => stepLocationKey(s))).toEqual([
                stepLocationKey(steps[0]),
                stepLocationKey(steps[1]),
            ]);
        });
    });

    describe('findReferencesForStep', () => {
        it('finds same text and same binding across features', () => {
            const source = createStep('Given', 'user is logged in', 5, '/test/a.feature', 'S1');
            const steps = [
                source,
                createStep('Given', 'user is logged in', 8, '/test/b.feature', 'S2'),
                createStep('Given', 'the app is ready', 12, '/test/a.feature', 'S3'),
            ];

            const refs = findReferencesForStep(source, steps, resolve);
            const keys = refs.map(r => stepLocationKey(r.step));

            expect(keys).toContain(stepLocationKey(source));
            expect(keys).toContain(stepLocationKey(steps[1]));
            expect(keys).not.toContain(stepLocationKey(steps[2]));
            expect(refs.find(r => stepLocationKey(r.step) === stepLocationKey(steps[1]))?.kind).toBe(
                'same-text'
            );
        });

        it('includes steps that match via binding when text differs slightly but regex matches', () => {
            const binding = createBinding('When', 'I press "(.+)"', 'PressButton', 15);
            const deps: ResolverDependencies = {
                getAllBindings: () => [binding],
                getBindingsByKeyword: () => [binding],
            };
            const resolveWhen = createResolver(deps);

            const source = createStep('When', 'I press "save"', 3);
            const other = createStep('When', 'I press "cancel"', 7, '/test/other.feature');

            const refs = findReferencesForStep(source, [source, other], resolveWhen);
            expect(refs.length).toBeGreaterThanOrEqual(2);
            expect(refs.some(r => r.kind === 'same-binding' && stepLocationKey(r.step) === stepLocationKey(other))).toBe(true);
        });
    });
});
