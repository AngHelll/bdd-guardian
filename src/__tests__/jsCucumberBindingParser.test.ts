import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { parseJsCucumberBindingsFromText } from '../core/parsing/jsCucumberBindingParser';

describe('parseJsCucumberBindingsFromText', () => {
    it('parses Given/When/Then with Cucumber Expressions and regex literals', () => {
        const text = `
import { Given, When, Then } from '@cucumber/cucumber';

Given('I have {int} cucumbers', function (count) {});
When("I search for {string}", function (query) {});
Then(/I should see "([^"]+)" in results/, function (expected) {});
`;
        const bindings = parseJsCucumberBindingsFromText(text, vscode.Uri.file('/t.ts'));
        expect(bindings.length).toBe(3);

        const given = bindings.find((b) => b.keyword === 'Given')!;
        expect(given.regex.test('I have 5 cucumbers')).toBe(true);

        const when = bindings.find((b) => b.keyword === 'When')!;
        expect(when.regex.test('I search for "milk"')).toBe(true);

        const then = bindings.find((b) => b.keyword === 'Then')!;
        expect(then.regex.test('I should see "milk" in results')).toBe(true);
    });

    it('ignores files that do not reference @cucumber/cucumber', () => {
        const text = `Given('x', () => {});`;
        const bindings = parseJsCucumberBindingsFromText(text, vscode.Uri.file('/x.ts'));
        expect(bindings).toHaveLength(0);
    });
});

