import { describe, expect, it } from 'vitest';
import {
    buildCSharpNewFileContent,
    buildJsNewFileContent,
    defaultNewScaffoldPath,
    findCSharpBindingInsertLine,
    formatJsAppend,
    formatSnippetForInsert,
    getIndentForLine,
    pickScaffoldTargetPath,
    sanitizeMethodName,
    supportsScaffoldInsert,
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

describe('scaffoldInsert', () => {
    it('supportsScaffoldInsert allows C# and JS only', () => {
        expect(supportsScaffoldInsert('csharp-reqnroll')).toBe(true);
        expect(supportsScaffoldInsert('csharp-specflow')).toBe(true);
        expect(supportsScaffoldInsert('js-cucumber')).toBe(true);
        expect(supportsScaffoldInsert('python-behave')).toBe(false);
        expect(supportsScaffoldInsert('go-godog')).toBe(false);
    });

    it('findCSharpBindingInsertLine returns closing brace of first [Binding] class', () => {
        const line = findCSharpBindingInsertLine(SAMPLE_CS);
        expect(line).not.toBeNull();
        const lines = SAMPLE_CS.split('\n');
        expect(lines[line!].trim()).toBe('}');
        expect(lines.slice(0, line!).join('\n')).toContain('GivenTheCalculatorIsInitialized');
        expect(lines.slice(0, line!).join('\n')).not.toContain('OtherSteps');
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
    });

    it('defaultNewScaffoldPath returns conventional paths', () => {
        expect(defaultNewScaffoldPath('csharp-reqnroll')).toBe(
            'StepDefinitions/GuardianGeneratedSteps.cs'
        );
        expect(defaultNewScaffoldPath('js-cucumber')).toBe(
            'features/step_definitions/guardian-generated.steps.ts'
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
        expect(content).toContain("@cucumber/cucumber");
    });

    it('formatJsAppend adds separator before new snippet', () => {
        expect(formatJsAppend(`Given('y', () => {});`, 'Given("x", () => {});')).toMatch(
            /\n\nGiven\('y'/
        );
    });
});
