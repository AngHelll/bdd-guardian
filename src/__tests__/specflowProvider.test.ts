/**
 * C# SpecFlow provider tests
 */
import { describe, it, expect } from 'vitest';
import { CSharpSpecflowProvider } from '../providers/bindings/csharpSpecflowProvider';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { createMockDocument, Uri } from './mocks/vscode';

const SPECFLOW_STEPS = `
using TechTalk.SpecFlow;

namespace Sample.Steps
{
    [Binding]
    public class LoginSteps
    {
        [Given(@"the user is logged in")]
        public void GivenTheUserIsLoggedIn() { }

        [When(@"the user opens the dashboard")]
        public void WhenTheUserOpensTheDashboard() { }
    }
}
`;

describe('CSharpSpecflowProvider', () => {
    it('parses bindings with shared C# parser', () => {
        const provider = new CSharpSpecflowProvider();
        const doc = createMockDocument(SPECFLOW_STEPS, '/test/LoginSteps.cs');
        const bindings = provider.parseFile(doc as any);
        expect(bindings).toHaveLength(2);
        expect(bindings[0].methodName).toBe('GivenTheUserIsLoggedIn');
        expect(bindings[1].methodName).toBe('WhenTheUserOpensTheDashboard');
    });

    it('assigns correct class name per binding block', () => {
        const bindings = parseCSharpBindingsFromText(
            SPECFLOW_STEPS,
            Uri.file('/test/LoginSteps.cs') as any
        );
        expect(bindings.every((b) => b.className === 'LoginSteps')).toBe(true);
    });
});
