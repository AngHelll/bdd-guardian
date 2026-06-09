import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { parsePythonBehaveBindingsFromText } from '../core/parsing/pythonBehaveBindingParser';

describe('parsePythonBehaveBindingsFromText', () => {
    it('parses @given/@when/@then with behave placeholders and literals', () => {
        const text = `
from behave import given, when, then

@given('I have {n} cucumbers')
def step_given_cukes(context):
    pass

@when("I search for {query}")
def step_when_search(context, query):
    pass

@then('I should see "{message}" in results')
def step_then_results(context, message):
    pass
`;
        const bindings = parsePythonBehaveBindingsFromText(text, vscode.Uri.file('/features/steps/search.py'));
        expect(bindings.length).toBe(3);

        const given = bindings.find((b) => b.keyword === 'Given')!;
        expect(given.methodName).toBe('step_given_cukes');
        expect(given.regex.test('I have 5 cucumbers')).toBe(true);

        const when = bindings.find((b) => b.keyword === 'When')!;
        expect(when.regex.test('I search for milk')).toBe(true);

        const then = bindings.find((b) => b.keyword === 'Then')!;
        expect(then.methodName).toBe('step_then_results');
        expect(then.regex.test('I should see "milk" in results')).toBe(true);
    });

    it('ignores files that do not import behave', () => {
        const text = `@given('x')\ndef step_impl(context):\n    pass\n`;
        const bindings = parsePythonBehaveBindingsFromText(text, vscode.Uri.file('/x.py'));
        expect(bindings).toHaveLength(0);
    });
});
