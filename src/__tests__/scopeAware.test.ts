/**
 * Scope-aware matching (v1.11.0) — parser + resolver policy
 */
import { describe, it, expect } from 'vitest';
import { parseCSharpBindingsFromText, extractScopeTagsFromText } from '../core/parsing/csharpBindingParser';
import { createResolver } from '../core/matching/resolver';
import { isBindingInScope, normalizeScopeTag } from '../core/matching/scopeFilter';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { Uri, Range } from './mocks/vscode';

function binding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    scopeTags: readonly string[] = []
): Binding {
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'Steps',
        methodName,
        uri: Uri.file('/t.cs') as any,
        range: new Range(0, 0, 0, 0) as any,
        lineNumber: 0,
        signature: `Steps.${methodName}`,
        scopeTags,
    };
}

function step(keyword: ResolvedKeyword, text: string, tagsEffective: readonly string[]): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text,
        fullText: `${keyword} ${text}`,
        tagsEffective,
        uri: Uri.file('/f.feature') as any,
        range: new Range(0, 0, 0, 0) as any,
        lineNumber: 0,
        isOutline: false,
        candidateTexts: [text],
    };
}

describe('normalizeScopeTag / isBindingInScope', () => {
    it('normalizes @ prefix and case', () => {
        expect(normalizeScopeTag('@Web')).toBe('web');
        expect(normalizeScopeTag('api')).toBe('api');
    });

    it('global binding (no scope) is always in scope', () => {
        const b = binding('Given', 'x', 'G', []);
        expect(isBindingInScope(b, [])).toBe(true);
        expect(isBindingInScope(b, ['@web'])).toBe(true);
    });

    it('scoped binding requires matching step tag', () => {
        const b = binding('Given', 'x', 'G', ['web']);
        expect(isBindingInScope(b, ['@web'])).toBe(true);
        expect(isBindingInScope(b, ['@api'])).toBe(false);
        expect(isBindingInScope(b, [])).toBe(false);
    });

    it('OR across multiple scope tags on one binding', () => {
        const b = binding('Given', 'x', 'G', ['web', 'mobile']);
        expect(isBindingInScope(b, ['@mobile'])).toBe(true);
        expect(isBindingInScope(b, ['@api'])).toBe(false);
    });
});

describe('extractScopeTagsFromText / csharp parser Scope', () => {
    it('extracts Scope(Tag=) from attribute text', () => {
        expect(extractScopeTagsFromText('[Given("x"), Scope(Tag = "web")]')).toEqual(['web']);
        expect(extractScopeTagsFromText('[Scope(Tag = @"api")]')).toEqual(['api']);
    });

    it('parses method-level Scope on same attribute list', () => {
        const text = `
[Binding]
public class S {
    [Given("I log in"), Scope(Tag = "web")]
    public void LoginWeb() { }

    [Given("I log in"), Scope(Tag = "api")]
    public void LoginApi() { }
}
`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/S.cs') as any);
        const web = bindings.find((b) => b.methodName === 'LoginWeb');
        const api = bindings.find((b) => b.methodName === 'LoginApi');
        expect(web?.scopeTags).toEqual(['web']);
        expect(api?.scopeTags).toEqual(['api']);
    });

    it('unions class-level Scope with method Scope', () => {
        const text = `
[Binding]
[Scope(Tag = "shared")]
public class SharedSteps {
    [Given("hello"), Scope(Tag = "web")]
    public void Hello() { }
}
`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/S.cs') as any);
        expect([...bindings[0]!.scopeTags].sort()).toEqual(['shared', 'web'].sort());
    });

    it('parses separate [Scope] attribute above method', () => {
        const text = `
[Binding]
public class S {
    [Scope(Tag = "web")]
    [Given("I log in")]
    public void LoginWeb() { }
}
`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/S.cs') as any);
        expect(bindings[0]?.scopeTags).toEqual(['web']);
    });
});

describe('resolver scope filter', () => {
    const web = binding('Given', 'I log in', 'LoginWeb', ['web']);
    const api = binding('Given', 'I log in', 'LoginApi', ['api']);
    const global = binding('Given', 'the app is ready', 'AppReady', []);

    const resolve = createResolver({
        getAllBindings: () => [web, api, global],
        getBindingsByKeyword: (kw) => [web, api, global].filter((b) => b.keyword === kw),
        preferSpecificBinding: false,
    });

    it('binds web-scoped method when step has @web', () => {
        const result = resolve(step('Given', 'I log in', ['@web']));
        expect(result.status).toBe('bound');
        expect(result.best?.binding.methodName).toBe('LoginWeb');
        expect(result.candidates).toHaveLength(1);
    });

    it('binds api-scoped method when step has @api', () => {
        const result = resolve(step('Given', 'I log in', ['@api']));
        expect(result.status).toBe('bound');
        expect(result.best?.binding.methodName).toBe('LoginApi');
    });

    it('excludes scoped bindings when step has no tags → unbound', () => {
        const result = resolve(step('Given', 'I log in', []));
        expect(result.status).toBe('unbound');
    });

    it('global binding still matches with or without tags', () => {
        expect(resolve(step('Given', 'the app is ready', [])).status).toBe('bound');
        expect(resolve(step('Given', 'the app is ready', ['@web'])).status).toBe('bound');
    });

    it('does not mark ambiguous when out-of-scope twin is filtered', () => {
        const result = resolve(step('Given', 'I log in', ['@web']));
        expect(result.status).not.toBe('ambiguous');
        expect(result.candidates.map((c) => c.binding.methodName)).toEqual(['LoginWeb']);
    });
});
