import { describe, it, expect } from 'vitest';
import {
    collectCSharpParameterTypes,
    mergeCSharpParameterTypes,
    parseCSharpBindingsFromText,
} from '../core/parsing/csharpBindingParser';
import { Uri } from './mocks/vscode';

const DOWNLOAD = 'I download the release {my_version} of the application';
const DOWNLOAD_STEP = 'I download the release v1.2.3 of the application';

function whenWith(pattern: string): string {
    return `[When("${pattern}", ExpressionType = ExpressionType.CucumberExpression)]
public void WhenIDownload(string version) { }`;
}

describe('C# StepArgumentTransformation', () => {
    it('binds {my_version} from a named regex and rejects a missing v', () => {
        const text = `[StepArgumentTransformation(@"v(.*)", Name = "my_version")]
public string VersionTransform(string version) => version;

${whenWith(DOWNLOAD)}`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/Steps.cs') as never);
        const when = bindings.find((b) => b.methodName === 'WhenIDownload');
        expect(when).toBeDefined();
        expect(when!.regex.test(DOWNLOAD_STEP)).toBe(true);
        expect(when!.regex.test('I download the release 1.2.3 of the application')).toBe(false);
    });

    it('uses a simple return type when Name is absent', () => {
        const text = `[StepArgumentTransformation(@"EUR (\\d+)")]
public MyCurrency Parse(string amount) => new MyCurrency(amount);

[When("pay {MyCurrency}", ExpressionType = ExpressionType.CucumberExpression)]
public void WhenPay(MyCurrency amount) { }`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/Steps.cs') as never);
        const when = bindings.find((b) => b.methodName === 'WhenPay');
        expect(when!.regex.test('pay EUR 10')).toBe(true);
        expect(when!.regex.test('pay USD 10')).toBe(false);
    });

    it('does not apply a name that is defined twice', () => {
        const text = `[StepArgumentTransformation(@"v(.*)", Name = "my_version")]
public string A(string version) => version;

[StepArgumentTransformation(@"x(.*)", Name = "my_version")]
public string B(string version) => version;

${whenWith(DOWNLOAD)}`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/Steps.cs') as never);
        const when = bindings.find((b) => b.methodName === 'WhenIDownload');
        expect(when!.regex.test(DOWNLOAD_STEP)).toBe(false);
    });

    it('applies a transformation collected from another file', () => {
        const transforms = `[StepArgumentTransformation(@"v(.*)", Name = "my_version")]
public string VersionTransform(string version) => version;`;
        const steps = whenWith(DOWNLOAD);
        const parameterTypes = mergeCSharpParameterTypes([
            collectCSharpParameterTypes(transforms),
            collectCSharpParameterTypes(steps),
        ]);
        const bindings = parseCSharpBindingsFromText(steps, Uri.file('/Steps.cs') as never, {
            parameterTypes,
        });
        expect(bindings[0].regex.test(DOWNLOAD_STEP)).toBe(true);
    });

    it('does not match {Foo} when no transformation defines it', () => {
        const text = `[When("I have a {Foo} ball", ExpressionType = ExpressionType.CucumberExpression)]
public void WhenBall(string color) { }`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/Steps.cs') as never);
        expect(bindings[0].regex.test('I have a red ball')).toBe(false);
    });

    it('ignores a transformation that has no regex', () => {
        const text = `[StepArgumentTransformation]
public MyCurrency Parse(string input) => new MyCurrency(input);

[When("pay {MyCurrency}", ExpressionType = ExpressionType.CucumberExpression)]
public void WhenPay(MyCurrency amount) { }`;
        const bindings = parseCSharpBindingsFromText(text, Uri.file('/Steps.cs') as never);
        expect(bindings[0].regex.test('pay EUR 10')).toBe(false);
    });
});
