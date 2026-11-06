/**
 * Reqnroll match fidelity v1.24.0 — scope precedence, outline rows, method shape.
 */
import { describe, expect, it } from 'vitest';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { createResolver } from '../core/matching/resolver';
import { explainUnbound, unboundI18n } from '../core/matching/unboundExplain';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { createMockDocument, Range, Uri } from './mocks/vscode';
import { MAX_EXAMPLE_ROWS } from '../core/domain/constants';

function parseBindings(source: string): Binding[] {
    return parseCSharpBindingsFromText(source, Uri.file('/Steps.cs') as never);
}

function parseFeature(source: string) {
    return parseFeatureDocument(createMockDocument(source, '/fixture.feature') as never)!;
}

function resolveFeature(featureSource: string, csharp: string) {
    const feature = parseFeature(featureSource);
    const bindings = parseBindings(csharp);
    const resolve = createResolver({
        getAllBindings: () => bindings,
        getBindingsByKeyword: (keyword) => bindings.filter((binding) => binding.keyword === keyword),
        preferSpecificBinding: false,
    });
    return { feature, bindings, resolve };
}

function handBinding(
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
        uri: Uri.file('/Steps.cs') as never,
        range: new Range(0, 0, 0, 0) as never,
        lineNumber: 0,
        signature: `Steps.${methodName}`,
        scopeTags,
    };
}

function handStep(
    keyword: ResolvedKeyword,
    text: string,
    extra: Partial<FeatureStep> = {}
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text,
        fullText: `${keyword} ${text}`,
        tagsEffective: [],
        uri: Uri.file('/f.feature') as never,
        range: new Range(0, 0, 0, 0) as never,
        lineNumber: 0,
        isOutline: false,
        candidateTexts: [text],
        ...extra,
    };
}

describe('G1 scope Feature/Scenario and precedence', () => {
    const csharp = `
[Binding, Scope(Feature = "Allowed")]
public class ScopedSteps {
    [Given("a scoped step")]
    public void Scoped() {}
}
[Binding]
public class GlobalSteps {
    [Given("a scoped step")]
    public void Global() {}
}
`;

    it('drops a feature-scoped binding outside that feature', () => {
        const { feature, resolve } = resolveFeature(`
Feature: Other
  Scenario: Outside
    Given a scoped step
`, `
[Binding, Scope(Feature = "Allowed")]
public class ScopedSteps {
    [Given("a scoped step")]
    public void Scoped() {}
}
`);
        const step = feature.allSteps[0];
        const result = resolve(step);
        expect(result.status).toBe('unbound');
        const why = explainUnbound(step, parseBindings(`
[Binding, Scope(Feature = "Allowed")]
public class ScopedSteps {
    [Given("a scoped step")]
    public void Scoped() {}
}
`));
        expect(why.summaryKey).toBe('scopeExcluded');
        expect(unboundI18n(why).key).toBe('unboundScopeDetail');
        expect(unboundI18n(why).args[1]).toContain('feature "Allowed"');
    });

    it('prefers an applicable feature scope over a global binding', () => {
        const { feature, resolve } = resolveFeature(`
Feature: Allowed
  Scenario: Inside
    Given a scoped step
`, csharp);
        const result = resolve(feature.allSteps[0]);
        expect(result.status).toBe('bound');
        expect(result.candidates).toHaveLength(1);
        expect(result.best?.binding.methodName).toBe('Scoped');
    });

    it('keeps a real tie ambiguous when two scopes match the same number of criteria', () => {
        const { feature, resolve } = resolveFeature(`
@myTag1 @myTag2
Feature: Places
  Scenario: myScenario
    Given a scoped step
`, `
[Binding]
public class Ties {
    [Given("a scoped step")]
    [Scope(Tag = "myTag1", Scenario = "myScenario")]
    public void First() {}

    [Given("a scoped step")]
    [Scope(Tag = "myTag2", Scenario = "myScenario")]
    public void Second() {}
}
`);
        expect(resolve(feature.allSteps[0]).status).toBe('ambiguous');
    });

    it('parses Feature, Scenario, and Tag on one Scope, and ignores an empty Scope', () => {
        const bindings = parseBindings(`
[Binding]
[Scope(Scenario = "Inside", Feature = "Allowed", Tag = "@web")]
[Scope()]
public class ScopedSteps {
    [Given("a scoped step")]
    public void Scoped() {}
}
`);
        expect(bindings[0]?.scopes).toEqual([
            { scenario: 'Inside', feature: 'Allowed', tag: 'web' },
        ]);
        expect(bindings[0]?.scopeTags).toEqual(['web']);
    });

    it('still treats legacy scopeTags as tag rules, and a scoped tag beats a global', () => {
        const scoped = handBinding('Given', 'I log in', 'LoginWeb', ['web']);
        const global = handBinding('Given', 'I log in', 'LoginAny', []);
        const resolve = createResolver({
            getAllBindings: () => [scoped, global],
            getBindingsByKeyword: (keyword) => [scoped, global].filter((binding) => binding.keyword === keyword),
        });
        const result = resolve(handStep('Given', 'I log in', { tagsEffective: ['@web'] }));
        expect(result.status).toBe('bound');
        expect(result.best?.binding.methodName).toBe('LoginWeb');
    });
});

describe('G2 outline rows', () => {
    const csharp = `
[Binding]
public class StateSteps {
    [Given("state is ready")] public void Ready() {}
    [Given("state is pending")] public void Pending() {}
    [Given("state is X")] public void FallbackOnly() {}
}
`;

    it('does not call two row-specific methods ambiguous', () => {
        const { feature, resolve } = resolveFeature(`
Feature: Expansion coverage
  Scenario Outline: State
    Given state is <state>
    Examples:
      | state   |
      | ready   |
      | pending |
`, csharp);
        const step = feature.allSteps[0];
        const result = resolve(step);
        expect(result.status).toBe('bound');
        expect(result.candidates.map((candidate) => candidate.binding.methodName).sort()).toEqual([
            'Pending',
            'Ready',
        ]);
        expect(step.candidateTexts[0]).toBe('state is X');
    });

    it('does not stay bound when one row has no binding', () => {
        const { feature, resolve, bindings } = resolveFeature(`
Feature: Expansion coverage
  Scenario Outline: State
    Given state is <state>
    Examples:
      | state   |
      | ready   |
      | pending |
`, `
[Binding]
public class StateSteps {
    [Given("state is ready")] public void Ready() {}
}
`);
        const step = feature.allSteps[0];
        expect(resolve(step).status).toBe('unbound');
        const why = explainUnbound(step, bindings);
        expect(why.summaryKey).toBe('outlineRow');
        expect(why.rowLabel).toBe('pending');
        expect(unboundI18n(why).key).toBe('unboundOutlineRow');
    });

    it('does not let the X fallback prove coverage', () => {
        const { resolve, feature } = resolveFeature(`
Feature: Expansion coverage
  Scenario Outline: State
    Given state is <state>
    Examples:
      | state |
      | ready |
`, `
[Binding]
public class StateSteps {
    [Given("state is X")] public void FallbackOnly() {}
}
`);
        expect(resolve(feature.allSteps[0]).status).toBe('unbound');
    });

    it('treats a row past the cap as not bound', () => {
        const rows = Array.from({ length: MAX_EXAMPLE_ROWS + 1 }, () => '| ready |').join('\n');
        const { feature, resolve, bindings } = resolveFeature(`
Feature: Expansion coverage
  Scenario Outline: State
    Given state is <state>
    Examples:
      | state |
${rows}
`, `
[Binding]
public class StateSteps {
    [Given("state is ready")] public void Ready() {}
}
`);
        const step = feature.allSteps[0];
        expect(step.outlineTruncated).toBe(true);
        expect(resolve(step).status).toBe('unbound');
        expect(explainUnbound(step, bindings).summaryKey).toBe('outlineLimited');
    });

    it('keeps a step DataTable out of Examples and closes Examples at the next step', () => {
        const feature = parseFeature(`
Feature: Table boundaries
  Scenario Outline: Read items
    When I query with:
      | key  | value  |
      | kind | <kind> |
    Then the query succeeds
    Examples:
      | kind |
      | a    |
      | b    |
    When I query again
      | extra |
      | row   |
`);
        const query = feature.allSteps.find((step) => step.rawText === 'I query with:')!;
        const again = feature.allSteps.find((step) => step.rawText === 'I query again')!;
        expect(query.argumentTail).toBe('table');
        expect(query.outlineExpansions?.map((row) => row.text)).toEqual([
            'I query with:',
            'I query with:',
        ]);
        expect(again.argumentTail).toBe('table');
        expect(feature.scenarios[0].examples[0].rows).toEqual([['a'], ['b']]);
    });

    it('uses Examples tags only on that block\'s rows', () => {
        const feature = parseFeature(`
Feature: Example tags
  Scenario Outline: Tagged rows
    Given value <value>
    @smoke
    Examples:
      | value |
      | a     |
    Examples:
      | value |
      | b     |
  Scenario: Unrelated
    Given something else
`);
        const outline = feature.allSteps[0];
        const unrelated = feature.scenarios[1];
        expect(unrelated.tags).toEqual([]);
        expect(outline.outlineExpansions?.map((row) => row.tags)).toEqual([
            ['@smoke'],
            [],
        ]);
    });
});

describe('G3 method identity and argument shape', () => {
    const csharp = `
[Binding]
public class ConfigSteps {
    [Given("configuration exists")] public void WithoutTable() {}
    [Given("configuration exists")] public void WithTable(Table table) {}
    [Then("amount is 10")]
    [Then(@"amount is (\\d+)")]
    public void Amount(int amount) {}
}
`;

    it('picks the overload that matches the presence of a table', () => {
        const { feature, resolve } = resolveFeature(`
Feature: Config
  Scenario: bare
    Given configuration exists
  Scenario: with table
    Given configuration exists
      | name | value |
      | a    | b     |
`, csharp);
        const [bare, withTable] = feature.allSteps;
        expect(bare.argumentTail).toBe('none');
        expect(resolve(bare).status).toBe('bound');
        expect(resolve(bare).best?.binding.methodName).toBe('WithoutTable');
        expect(withTable.argumentTail).toBe('table');
        expect(resolve(withTable).status).toBe('bound');
        expect(resolve(withTable).best?.binding.methodName).toBe('WithTable');
        expect(resolve(withTable).candidates).toHaveLength(1);
    });

    it('counts two attributes on one method as one destination', () => {
        const { feature, resolve } = resolveFeature(`
Feature: Amount
  Scenario: fixed
    Then amount is 10
`, csharp);
        const result = resolve(feature.allSteps[0]);
        expect(result.status).toBe('bound');
        expect(result.candidates).toHaveLength(1);
        expect(result.best?.binding.methodName).toBe('Amount');
    });

    it('explains a signature miss instead of calling it ambiguous', () => {
        const { feature, resolve, bindings } = resolveFeature(`
Feature: Amount
  Scenario: fixed
    Then amount is 10
`, `
[Binding]
public class ConfigSteps {
    [Then("amount is 10")]
    public void Amount(int amount) {}
}
`);
        const step = feature.allSteps[0];
        expect(resolve(step).status).toBe('unbound');
        const why = explainUnbound(step, bindings);
        expect(why.summaryKey).toBe('signature');
        expect(unboundI18n(why).key).toBe('unboundSignature');
    });

    it('leaves an unreadable parameter list in place', () => {
        const bindings = parseBindings(`
[Binding]
public class Hard {
    [Given("configuration exists")]
    public void Weird(List<string> items = null) {}
}
`);
        expect(bindings[0]?.parameterTypes).toBeUndefined();
        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (keyword) => bindings.filter((binding) => binding.keyword === keyword),
        });
        expect(resolve(handStep('Given', 'configuration exists')).status).toBe('bound');
    });
});
