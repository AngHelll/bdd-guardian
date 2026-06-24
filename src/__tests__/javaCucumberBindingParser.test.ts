import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { parseJavaCucumberBindingsFromText } from '../core/parsing/javaCucumberBindingParser';

describe('parseJavaCucumberBindingsFromText', () => {
    it('parses @Given/@When/@Then with Cucumber expressions and value= forms', () => {
        const text = `
package com.example.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.cucumber.java.en.Then;

public class SearchStepDefinitions {

    @Given("I have {int} cucumbers")
    public void i_have_cukes(int count) {
    }

    @When(value = "I search for {word}")
    public void i_search_for(String query) {
    }

    @Then(value = { "I should see {string} in results" })
    public void i_should_see_in_results(String message) {
    }
}
`;
        const bindings = parseJavaCucumberBindingsFromText(
            text,
            vscode.Uri.file('/src/test/java/com/example/steps/SearchStepDefinitions.java')
        );

        expect(bindings.length).toBe(3);
        expect(bindings.every((b) => b.className === 'SearchStepDefinitions')).toBe(true);

        const given = bindings.find((b) => b.keyword === 'Given')!;
        expect(given.methodName).toBe('i_have_cukes');
        expect(given.regex.test('I have 5 cucumbers')).toBe(true);

        const when = bindings.find((b) => b.keyword === 'When')!;
        expect(when.methodName).toBe('i_search_for');
        expect(when.regex.test('I search for milk')).toBe(true);

        const then = bindings.find((b) => b.keyword === 'Then')!;
        expect(then.methodName).toBe('i_should_see_in_results');
        expect(then.regex.test('I should see "milk" in results')).toBe(true);
    });

    it('ignores files without cucumber java imports', () => {
        const text = `
public class PlainJava {
    @Given("x")
    public void step() {}
}
`;
        const bindings = parseJavaCucumberBindingsFromText(
            text,
            vscode.Uri.file('/PlainJava.java')
        );
        expect(bindings).toHaveLength(0);
    });

    it('accepts legacy cucumber.api.java imports', () => {
        const text = `
import cucumber.api.java.en.Given;

public class LegacySteps {
    @Given("legacy step")
    public void legacy_step() {}
}
`;
        const bindings = parseJavaCucumberBindingsFromText(
            text,
            vscode.Uri.file('/LegacySteps.java')
        );
        expect(bindings).toHaveLength(1);
        expect(bindings[0].patternRaw).toBe('legacy step');
    });
});
