import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { createMockDocument } from './mocks/vscode';

function parse(content: string) {
    const doc = createMockDocument(content, 'fixture.feature');
    return parseFeatureDocument(doc as never);
}

const SPEC_FIXTURE = `Feature: Login
  Given this description line mentions a precondition

  Scenario: ok
    Given a user
    * the user logs in
    Then the payload is
      """
      Given inside a docstring
      When also inside
      """
    And done
`;

describe('gherkinParser fidelity', () => {
    it('ignores feature description and docstring text, and resolves * and And', () => {
        const doc = parse(SPEC_FIXTURE);
        expect(doc).toBeDefined();
        expect(doc!.allSteps.map((s) => `${s.keywordOriginal}:${s.keywordResolved}:${s.rawText}`)).toEqual([
            'Given:Given:a user',
            '*:Given:the user logs in',
            'Then:Then:the payload is',
            'And:Then:done',
        ]);
    });

    it('ignores lines inside ``` docstrings, including a content type', () => {
        const doc = parse(`Feature: F
  Scenario: s
    When the body is
      \`\`\`json
      Given hidden
      \`\`\`
    And after
`);
        expect(doc!.allSteps.map((s) => s.rawText)).toEqual(['the body is', 'after']);
        expect(doc!.allSteps[1].keywordResolved).toBe('When');
    });

    it('does not index a Given line in a Rule description, and drops Rule tags', () => {
        const doc = parse(`Feature: F
  @onRule
  Rule: grouping
    Given this is rule prose

  @web
  Scenario: scoped
    Given a user
`);
        expect(doc!.allSteps).toHaveLength(1);
        expect(doc!.allSteps[0].rawText).toBe('a user');
        expect(doc!.allSteps[0].tagsEffective).toEqual(['@web']);
        expect(doc!.scenarios[0].name).toBe('scoped');
    });

    it('treats * as Given when it is the first step', () => {
        const doc = parse(`Feature: F
  Scenario: s
    * the user logs in
`);
        expect(doc!.allSteps[0].keywordOriginal).toBe('*');
        expect(doc!.allSteps[0].keywordResolved).toBe('Given');
    });

    it('resolves * after Then as Then', () => {
        const doc = parse(`Feature: F
  Scenario: s
    Then the screen is ready
    * the banner is visible
`);
        expect(doc!.allSteps[1].keywordResolved).toBe('Then');
    });

    it('keeps Example: tags on the scenario steps', () => {
        const doc = parse(`Feature: F
  @fast
  Example: login
    Given a user
`);
        expect(doc!.scenarios).toHaveLength(1);
        expect(doc!.scenarios[0].type).toBe('Scenario');
        expect(doc!.scenarios[0].name).toBe('login');
        expect(doc!.scenarios[0].tags).toEqual(['@fast']);
        expect(doc!.allSteps[0].tagsEffective).toEqual(['@fast']);
        expect(doc!.allSteps[0].scenarioName).toBe('login');
    });

    it('expands Scenario Template + Scenarios like an outline', () => {
        const doc = parse(`Feature: F
  Scenario Template: greet
    When I greet <name>
  Scenarios:
    | name |
    | Ada  |
`);
        expect(doc!.scenarios[0].type).toBe('Scenario Outline');
        expect(doc!.allSteps[0].isOutline).toBe(true);
        expect(doc!.allSteps[0].candidateTexts).toContain('I greet Ada');
    });
});

describe('gherkinParser sample regression', () => {
    const expectedSteps: Record<string, number> = {
        'behave-demo/features/search.feature': 3,
        'binding-demo/Features/sample.feature': 37,
        'cucumber-demo/features/home.feature': 3,
        'cucumber-demo/features/search.feature': 3,
        'godog-demo/features/godogs.feature': 3,
        'java-cucumber-demo/src/test/resources/features/search.feature': 3,
    };

    it('keeps the same step count on every sample feature', () => {
        const root = join(__dirname, '../../samples');
        const found: Record<string, number> = {};
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!entry.endsWith('.feature')) {
                    continue;
                }
                const relative = full.slice(root.length + 1);
                const doc = parse(readFileSync(full, 'utf-8'));
                found[relative] = doc?.allSteps.length ?? -1;
            }
        };
        walk(root);
        expect(found).toEqual(expectedSteps);
    });
});
