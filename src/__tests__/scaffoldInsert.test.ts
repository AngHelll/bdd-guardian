import { describe, expect, it } from 'vitest';
import {
    buildCSharpNewFileContent,
    buildGoNewFileContent,
    buildJavaNewFileContent,
    buildJsNewFileContent,
    buildPythonNewFileContent,
    defaultNewScaffoldPath,
    findCSharpBindingInsertLine,
    findGoInitializeScenarioInsertLine,
    findJavaStepClassInsertLine,
    formatJsAppend,
    formatSnippetForInsert,
    getIndentForLine,
    pickScaffoldTargetPath,
    sanitizeMethodName,
    stripGoScaffoldComment,
    supportsScaffoldInsert,
    usesAppendInsert,
} from '../features/author/scaffoldInsert';

const SAMPLE_CS = `using Reqnroll;

namespace Calculator.Steps
{
    [Binding]
    public class CalculatorSteps
    {
        [Given(@"the calculator is initialized")]
        public void GivenTheCalculatorIsInitialized()
        {
            _result = 0;
        }
    }

    [Binding]
    public class OtherSteps
    {
        [When(@"something happens")]
        public void WhenSomething() { }
    }
}
`;

const SAMPLE_JAVA = `package com.example.steps;

import io.cucumber.java.en.Given;

public class SearchStepDefinitions {

    @Given("I have {int} cucumbers")
    public void i_have_cukes(int count) {
    }
}
`;

const SAMPLE_GO = `package godogdemo_test

import (
	"context"
	"github.com/cucumber/godog"
)

func InitializeScenario(ctx *godog.ScenarioContext) {
	ctx.Given(\`^there are (\\d+) godogs$\`, thereAreGodogs)
}
`;

describe('scaffoldInsert', () => {
    it('supportsScaffoldInsert allows all five framework stacks', () => {
        expect(supportsScaffoldInsert('csharp-reqnroll')).toBe(true);
        expect(supportsScaffoldInsert('csharp-specflow')).toBe(true);
        expect(supportsScaffoldInsert('js-cucumber')).toBe(true);
        expect(supportsScaffoldInsert('python-behave')).toBe(true);
        expect(supportsScaffoldInsert('go-godog')).toBe(true);
        expect(supportsScaffoldInsert('java-cucumber')).toBe(true);
        expect(supportsScaffoldInsert('generic-csharp-fallback')).toBe(false);
    });

    it('usesAppendInsert is true for JS and Python only', () => {
        expect(usesAppendInsert('js-cucumber')).toBe(true);
        expect(usesAppendInsert('python-behave')).toBe(true);
        expect(usesAppendInsert('go-godog')).toBe(false);
        expect(usesAppendInsert('java-cucumber')).toBe(false);
    });

    it('findCSharpBindingInsertLine returns closing brace of first [Binding] class', () => {
        const line = findCSharpBindingInsertLine(SAMPLE_CS);
        expect(line).not.toBeNull();
        const lines = SAMPLE_CS.split('\n');
        expect(lines[line!].trim()).toBe('}');
        expect(lines.slice(0, line!).join('\n')).toContain('GivenTheCalculatorIsInitialized');
        expect(lines.slice(0, line!).join('\n')).not.toContain('OtherSteps');
    });

    it('findJavaStepClassInsertLine returns closing brace of step class', () => {
        const line = findJavaStepClassInsertLine(SAMPLE_JAVA);
        expect(line).not.toBeNull();
        expect(SAMPLE_JAVA.split('\n')[line!].trim()).toBe('}');
    });

    it('findGoInitializeScenarioInsertLine returns closing brace of InitializeScenario', () => {
        const line = findGoInitializeScenarioInsertLine(SAMPLE_GO);
        expect(line).not.toBeNull();
        expect(SAMPLE_GO.split('\n')[line!].trim()).toBe('}');
    });

    it('sanitizeMethodName builds stable identifier from keyword and text', () => {
        expect(sanitizeMethodName('Given', 'I have 3 items')).toMatch(
            /^GuardianGenerated_Given_I_have_3_items$/
        );
        expect(sanitizeMethodName('When', '!!!')).toBe('GuardianGenerated_When_Step');
    });

    it('formatSnippetForInsert indents method body', () => {
        const snippet = `[Given(@"foo")]\npublic void Foo() { }`;
        const formatted = formatSnippetForInsert(snippet, '    ');
        expect(formatted).toContain('        [Given(@"foo")]');
        expect(formatted).toContain('        public void Foo() { }');
    });

    it('getIndentForLine reads leading whitespace', () => {
        expect(getIndentForLine('    [Binding]\n        public void X()', 1)).toBe('        ');
    });

    it('pickScaffoldTargetPath prefers indexed binding paths by extension', () => {
        expect(
            pickScaffoldTargetPath('csharp-reqnroll', [
                '/proj/features/foo.feature',
                '/proj/StepDefinitions/SampleSteps.cs',
            ])
        ).toBe('/proj/StepDefinitions/SampleSteps.cs');
        expect(
            pickScaffoldTargetPath('js-cucumber', [
                '/proj/features/search.feature',
                '/proj/features/step_definitions/search.steps.ts',
            ])
        ).toBe('/proj/features/step_definitions/search.steps.ts');
        expect(
            pickScaffoldTargetPath('python-behave', [
                '/proj/other.py',
                '/proj/features/steps/search_steps.py',
            ])
        ).toBe('/proj/features/steps/search_steps.py');
        expect(
            pickScaffoldTargetPath('go-godog', ['/proj/main.go', '/proj/godogs_test.go'])
        ).toBe('/proj/godogs_test.go');
        expect(
            pickScaffoldTargetPath('java-cucumber', [
                '/proj/src/test/java/com/example/steps/SearchStepDefinitions.java',
            ])
        ).toBe('/proj/src/test/java/com/example/steps/SearchStepDefinitions.java');
    });

    it('defaultNewScaffoldPath returns conventional paths for five stacks', () => {
        expect(defaultNewScaffoldPath('csharp-reqnroll')).toBe(
            'StepDefinitions/GuardianGeneratedSteps.cs'
        );
        expect(defaultNewScaffoldPath('js-cucumber')).toBe(
            'features/step_definitions/guardian-generated.steps.ts'
        );
        expect(defaultNewScaffoldPath('python-behave')).toBe(
            'features/steps/guardian_generated_steps.py'
        );
        expect(defaultNewScaffoldPath('go-godog')).toBe(
            'features/guardian_generated_steps_test.go'
        );
        expect(defaultNewScaffoldPath('java-cucumber')).toBe(
            'src/test/java/generated/GuardianGeneratedSteps.java'
        );
    });

    it('buildCSharpNewFileContent wraps snippet with Reqnroll usings', () => {
        const content = buildCSharpNewFileContent(
            `[Given(@"x")]\npublic void X() { }`,
            'csharp-reqnroll'
        );
        expect(content).toContain('using Reqnroll;');
        expect(content).toContain('class GuardianGeneratedSteps');
        expect(content).toContain('[Given(@"x")]');
    });

    it('buildJsNewFileContent includes cucumber import', () => {
        const content = buildJsNewFileContent(`Given('x', () => {});`);
        expect(content).toContain('@cucumber/cucumber');
    });

    it('buildPythonNewFileContent includes behave import', () => {
        const content = buildPythonNewFileContent(`@given('x')\ndef step(context):\n    pass`);
        expect(content).toContain('from behave import');
        expect(content).toContain("@given('x')");
    });

    it('buildGoNewFileContent wraps InitializeScenario', () => {
        const snippet = `// In InitializeScenario:\nctx.Given(\`^x$\`, func(ctx context.Context) error {\n    return nil\n})`;
        const content = buildGoNewFileContent(snippet);
        expect(content).toContain('package features');
        expect(content).toContain('func InitializeScenario');
        expect(content).toContain('ctx.Given');
        expect(content).not.toContain('// In InitializeScenario');
    });

    it('buildJavaNewFileContent wraps class and imports', () => {
        const content = buildJavaNewFileContent(`@Given("x")\npublic void x() {\n}`);
        expect(content).toContain('package generated;');
        expect(content).toContain('class GuardianGeneratedSteps');
        expect(content).toContain('@Given("x")');
    });

    it('stripGoScaffoldComment removes guidance line', () => {
        expect(stripGoScaffoldComment('// In InitializeScenario:\nctx.Given(`x`, f)')).toBe(
            'ctx.Given(`x`, f)'
        );
    });

    it('formatJsAppend adds separator before new snippet', () => {
        expect(formatJsAppend(`Given('y', () => {});`, 'Given("x", () => {});')).toMatch(
            /\n\nGiven\('y'/
        );
    });
});
