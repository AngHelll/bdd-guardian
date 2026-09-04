import { describe, expect, it } from 'vitest';
import {
    explainUnbound,
    unboundI18n,
    UNBOUND_OUT_OF_SCOPE_CAP,
} from '../core/matching/unboundExplain';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { Range, Uri } from './mocks/vscode';

function createBinding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    options: { scopeTags?: readonly string[]; lineNumber?: number } = {}
): Binding {
    const lineNumber = options.lineNumber ?? 10;
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'TestSteps',
        methodName,
        uri: Uri.file('/test/Steps.cs') as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        signature: `TestSteps.${methodName}`,
        scopeTags: options.scopeTags ?? [],
    };
}

function createStep(
    keyword: ResolvedKeyword,
    text: string,
    options: { tagsEffective?: readonly string[] } = {}
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text.replace(/\s+/g, ' ').trim(),
        fullText: `${keyword} ${text}`,
        tagsEffective: options.tagsEffective ?? [],
        uri: Uri.file('/test/a.feature') as any,
        range: new Range(5, 0, 5, 80) as any,
        lineNumber: 5,
        isOutline: false,
        candidateTexts: [text],
    };
}

describe('explainUnbound', () => {
    it('returns emptyIndex when no bindings are indexed', () => {
        const step = createStep('Given', 'I log in with scoped credentials');
        const explanation = explainUnbound(step, []);
        expect(explanation.summaryKey).toBe('emptyIndex');
        expect(explanation.indexedCount).toBe(0);
        expect(explanation.outOfScopeMatches).toHaveLength(0);
        expect(unboundI18n(explanation)).toEqual({
            key: 'unboundEmptyIndex',
            args: [],
        });
    });

    it('returns scopeExcluded when regex matches but Scope tags do not apply (@v111-like)', () => {
        const step = createStep('Given', 'I log in with scoped credentials');
        const bindings = [
            createBinding('Given', 'I log in with scoped credentials', 'LoginWeb', {
                scopeTags: ['web'],
                lineNumber: 20,
            }),
            createBinding('Given', 'I log in with scoped credentials', 'LoginApi', {
                scopeTags: ['api'],
                lineNumber: 30,
            }),
        ];
        const explanation = explainUnbound(step, bindings);
        expect(explanation.summaryKey).toBe('scopeExcluded');
        expect(explanation.outOfScopeMatches.map((m) => m.methodName)).toEqual([
            'LoginWeb',
            'LoginApi',
        ]);
        expect(explanation.requiredTags).toEqual(['@web', '@api']);
        expect(unboundI18n(explanation)).toEqual({
            key: 'unboundScopeExcluded',
            args: ['2', '@web, @api'],
        });
    });

    it('returns generic when bindings exist but none match the step text', () => {
        const step = createStep('Given', 'no such binding exists');
        const bindings = [
            createBinding('Given', 'user is logged in', 'UserIsLoggedIn'),
            createBinding('When', 'they add 1 and 2', 'AddNumbers'),
        ];
        const explanation = explainUnbound(step, bindings);
        expect(explanation.summaryKey).toBe('generic');
        expect(explanation.indexedCount).toBe(2);
        expect(explanation.outOfScopeMatches).toHaveLength(0);
        expect(unboundI18n(explanation)).toEqual({
            key: 'unboundGeneric',
            args: ['2'],
        });
    });

    it('returns generic (does not invent bound) when an in-scope regex match exists', () => {
        const step = createStep('Given', 'user is logged in', { tagsEffective: ['@web'] });
        const bindings = [
            createBinding('Given', 'user is logged in', 'UserIsLoggedIn'),
        ];
        const explanation = explainUnbound(step, bindings);
        expect(explanation.summaryKey).toBe('generic');
        expect(explanation.outOfScopeMatches).toHaveLength(0);
        expect(unboundI18n(explanation).key).toBe('unboundGeneric');
    });

    it(`caps outOfScopeMatches at ${UNBOUND_OUT_OF_SCOPE_CAP}`, () => {
        const step = createStep('Given', 'I log in with scoped credentials');
        const bindings = [1, 2, 3, 4].map((n) =>
            createBinding('Given', 'I log in with scoped credentials', `Login${n}`, {
                scopeTags: ['web'],
                lineNumber: n,
            })
        );
        const explanation = explainUnbound(step, bindings);
        expect(explanation.summaryKey).toBe('scopeExcluded');
        expect(explanation.outOfScopeMatches).toHaveLength(UNBOUND_OUT_OF_SCOPE_CAP);
        expect(explanation.outOfScopeCount).toBe(4);
        expect(explanation.requiredTags).toEqual(['@web']);
        expect(unboundI18n(explanation).args[0]).toBe('4');
    });
});
