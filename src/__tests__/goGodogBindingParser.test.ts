import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import {
    parseGoGodogBindingsFromText,
    looksLikeGodogBindingFile,
} from '../core/parsing/goGodogBindingParser';

describe('parseGoGodogBindingsFromText', () => {
    it('parses Given/When/Then with backtick regex patterns', () => {
        const text = `
package main_test

import "github.com/cucumber/godog"

func InitializeScenario(ctx *godog.ScenarioContext) {
    ctx.Given(\`^there are (\\d+) godogs$\`, thereAreGodogs)
    ctx.When(\`^I eat (\\d+)$\`, iEat)
    ctx.Then(\`^there should be (\\d+) remaining$\`, thereShouldBeRemaining)
}
`;
        const bindings = parseGoGodogBindingsFromText(text, vscode.Uri.file('/godogs_test.go'));
        expect(bindings).toHaveLength(3);

        const given = bindings.find((b) => b.methodName === 'thereAreGodogs')!;
        expect(given.keyword).toBe('Given');
        expect(given.regex.test('there are 3 godogs')).toBe(true);

        const when = bindings.find((b) => b.methodName === 'iEat')!;
        expect(when.regex.test('I eat 2')).toBe(true);

        const then = bindings.find((b) => b.methodName === 'thereShouldBeRemaining')!;
        expect(then.regex.test('there should be 1 remaining')).toBe(true);
    });

    it('parses ctx.Step for Given, When, and Then (godog generic step)', () => {
        const text = `
import "github.com/cucumber/godog"

func initSteps(ctx *godog.ScenarioContext) {
    ctx.Step(\`^I have (\\d+) items$\`, iHaveItems)
}
`;
        const bindings = parseGoGodogBindingsFromText(text, vscode.Uri.file('/steps_test.go'));
        expect(bindings).toHaveLength(3);
        expect(bindings.map((b) => b.keyword).sort()).toEqual(['Given', 'Then', 'When']);
        expect(bindings[0].regex.test('I have 5 items')).toBe(true);
    });

    it('ignores .go files without godog step patterns', () => {
        const text = `package main\nfunc main() {}\n`;
        expect(looksLikeGodogBindingFile(text)).toBe(false);
        expect(parseGoGodogBindingsFromText(text, vscode.Uri.file('/main.go'))).toHaveLength(0);
    });
});
