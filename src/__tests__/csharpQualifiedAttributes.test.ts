/**
 * Qualified C# step attributes.
 * Unqualified forms stay as they were. Unknown namespaces are not step attributes.
 */
import { describe, expect, it } from 'vitest';
import {
    findCSharpBindingAttributes,
    parseCSharpBindingsFromText,
} from '../core/parsing/csharpBindingParser';
import { Uri } from './mocks/vscode';

const SOURCE = `
using Reqnroll;

public class PlainSteps
{
    [Given("the plain given fires")]
    public void PlainGiven() {}

    [When("the plain when fires")]
    public void PlainWhen() {}

    [Then("the plain then fires")]
    public void PlainThen() {}

    [StepDefinition("the plain step definition fires")]
    public void PlainAny() {}
}

[Binding]
public class ReqnrollQualifiedSteps
{
    [Reqnroll.Given("the reqnroll given fires")]
    public void ReqnrollGiven() {}

    [Reqnroll.When("the reqnroll when fires")]
    public void ReqnrollWhen() {}

    [Reqnroll.Then("the reqnroll then fires")]
    public void ReqnrollThen() {}

    [Reqnroll.GivenAttribute("the reqnroll given attribute fires")]
    public void ReqnrollGivenAttribute() {}

    [Reqnroll.WhenAttribute("the reqnroll when attribute fires")]
    public void ReqnrollWhenAttribute() {}

    [Reqnroll.ThenAttribute("the reqnroll then attribute fires")]
    public void ReqnrollThenAttribute() {}

    [global::Reqnroll.Given("the global given fires")]
    public void GlobalGiven() {}

    [global::Reqnroll.StepDefinition("the global step definition fires")]
    public void GlobalAny() {}

    [Reqnroll.Given("the qualified scope fires"), Scope(Tag = "web")]
    public void QualifiedScope() {}
}

[Reqnroll.Binding]
public class ReqnrollMarker
{
}

[Reqnroll.BindingAttribute]
public class ReqnrollMarkerSuffix
{
}

[global::Reqnroll.Binding()]
public class GlobalMarker
{
}

[TechTalk.SpecFlow.Binding]
public class SpecFlowMarker
{
    [TechTalk.SpecFlow.Given("the specflow given fires")]
    public void SpecFlowGiven() {}

    [global::TechTalk.SpecFlow.WhenAttribute("the specflow when attribute fires")]
    public void SpecFlowWhen() {}
}

public class NotSteps
{
    [Contoso.Given("the unknown namespace fires")]
    public void Unknown() {}

    [MyReqnroll.Given("the glued prefix fires")]
    public void Glued() {}

    [SpecFlow.Given("the short specflow name fires")]
    public void ShortSpecFlow() {}

    [global::Given("the bare global fires")]
    public void BareGlobal() {}

    [Reqnroll.GivenStep("the wrong attribute name fires")]
    public void WrongName() {}

    [GivenAttributeExtra("the extra suffix fires")]
    public void ExtraSuffix() {}
}

// Reqnroll.Given("the comment without brackets fires")
var note = "Given(\\"the string without brackets fires\\")";
`;

function parsed() {
    return parseCSharpBindingsFromText(SOURCE, Uri.file('/Qualified.cs') as never);
}

function byPattern(pattern: string) {
    return parsed().filter((binding) => binding.patternRaw === pattern);
}

describe('qualified C# step attributes', () => {
    it('keeps unqualified Given, When, Then and StepDefinition', () => {
        expect(byPattern('the plain given fires').map((binding) => binding.keyword)).toEqual(['Given']);
        expect(byPattern('the plain when fires').map((binding) => binding.keyword)).toEqual(['When']);
        expect(byPattern('the plain then fires').map((binding) => binding.keyword)).toEqual(['Then']);
        expect(byPattern('the plain step definition fires').map((binding) => binding.keyword).sort()).toEqual([
            'Given',
            'Then',
            'When',
        ]);
        const plain = byPattern('the plain given fires')[0];
        expect(plain.className).toBe('PlainSteps');
        expect(plain.methodName).toBe('PlainGiven');
        expect(plain.lineNumber).toBe(5);
        expect(plain.uri.fsPath).toBe('/Qualified.cs');
        expect(plain.scopeTags).toEqual([]);
        expect(plain.regex.test('the plain given fires')).toBe(true);
    });

    it('recognizes the verified Reqnroll forms for Given, When and Then', () => {
        expect(byPattern('the reqnroll given fires')[0]).toMatchObject({
            keyword: 'Given',
            className: 'ReqnrollQualifiedSteps',
            methodName: 'ReqnrollGiven',
        });
        expect(byPattern('the reqnroll when fires')[0].keyword).toBe('When');
        expect(byPattern('the reqnroll then fires')[0].keyword).toBe('Then');
        expect(byPattern('the reqnroll given attribute fires')[0]).toMatchObject({
            keyword: 'Given',
            methodName: 'ReqnrollGivenAttribute',
        });
        expect(byPattern('the reqnroll when attribute fires')[0].keyword).toBe('When');
        expect(byPattern('the reqnroll then attribute fires')[0].keyword).toBe('Then');
        expect(byPattern('the global given fires')[0]).toMatchObject({
            keyword: 'Given',
            methodName: 'GlobalGiven',
        });
    });

    it('expands a qualified StepDefinition into the three keywords on one method', () => {
        const bindings = byPattern('the global step definition fires');
        expect(bindings.map((binding) => binding.keyword).sort()).toEqual(['Given', 'Then', 'When']);
        expect(new Set(bindings.map((binding) => binding.methodName))).toEqual(new Set(['GlobalAny']));
        expect(new Set(bindings.map((binding) => binding.lineNumber)).size).toBe(1);
    });

    it('keeps scope metadata on a qualified attribute', () => {
        const binding = byPattern('the qualified scope fires')[0];
        expect(binding.keyword).toBe('Given');
        expect(binding.scopeTags).toEqual(['web']);
        expect(binding.methodName).toBe('QualifiedScope');
    });

    it('accepts the SpecFlow namespace and rejects unknown prefixes and lookalikes', () => {
        expect(byPattern('the specflow given fires')[0]).toMatchObject({
            keyword: 'Given',
            className: 'SpecFlowMarker',
            methodName: 'SpecFlowGiven',
        });
        expect(byPattern('the specflow when attribute fires')[0].keyword).toBe('When');

        for (const absent of [
            'the unknown namespace fires',
            'the glued prefix fires',
            'the short specflow name fires',
            'the bare global fires',
            'the wrong attribute name fires',
            'the extra suffix fires',
            'the comment without brackets fires',
            'the string without brackets fires',
        ]) {
            expect(byPattern(absent)).toEqual([]);
        }
    });

    it('lists Binding markers without changing which step methods are emitted', () => {
        const markers = findCSharpBindingAttributes(SOURCE);
        expect(markers.map((marker) => [marker.namespace, marker.attributeSuffix, marker.text.includes('()')])).toEqual([
            ['unqualified', false, false],
            ['reqnroll', false, false],
            ['reqnroll', true, false],
            ['reqnroll', false, true],
            ['specflow', false, false],
        ]);
        expect(markers.some((marker) => marker.text.includes('Other.Binding'))).toBe(false);
        const steps = parsed();
        expect(steps.some((binding) => binding.className === 'NotSteps')).toBe(false);
        expect(steps.filter((binding) => binding.className === 'PlainSteps')).toHaveLength(6);
    });
});
