/**
 * C# SpecFlow provider tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFiles = vi.fn();
const mockReadFile = vi.fn();

vi.mock('vscode', async () => {
    const mocks = await import('./mocks/vscode');
    return {
        ...mocks,
        workspace: {
            ...mocks.workspace,
            findFiles: (...args: unknown[]) => mockFindFiles(...args),
            fs: {
                readFile: (...args: unknown[]) => mockReadFile(...args),
            },
            asRelativePath: (p: string) => p,
        },
    };
});

import * as vscode from 'vscode';
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

const REQNROLL_CSPROJ = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Reqnroll" Version="3.0.0" />
  </ItemGroup>
</Project>`;

const SPECFLOW_CSPROJ = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="SpecFlow" Version="3.9.74" />
  </ItemGroup>
</Project>`;

const folder = {
    uri: vscode.Uri.file('/workspace'),
    name: 'workspace',
    index: 0,
};

describe('CSharpSpecflowProvider', () => {
    beforeEach(() => {
        mockFindFiles.mockReset();
        mockReadFile.mockReset();
    });

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

    it('returns confidence 0 when Reqnroll PackageReference is in csproj (T-T03)', async () => {
        const csprojUri = vscode.Uri.file('/workspace/App/App.csproj');
        const stepsUri = vscode.Uri.file('/workspace/StepDefinitions/SampleSteps.cs');

        mockFindFiles.mockImplementation(async (pattern: string) => {
            if (pattern.includes('csproj')) {
                return [csprojUri];
            }
            return [stepsUri];
        });
        mockReadFile.mockImplementation(async (uri: { fsPath: string }) => {
            if (uri.fsPath.endsWith('.csproj')) {
                return Buffer.from(REQNROLL_CSPROJ);
            }
            return Buffer.from('[Binding]\npublic class SampleSteps { }');
        });

        const provider = new CSharpSpecflowProvider();
        const result = await provider.detect([folder as any]);

        expect(result.confidence).toBe(0);
        expect(result.reasons.some((r) => r.includes('Reqnroll'))).toBe(true);
    });

    it('returns confidence 0 when using Reqnroll in C# files (T-T03)', async () => {
        const stepsUri = vscode.Uri.file('/workspace/StepDefinitions/SampleSteps.cs');

        mockFindFiles.mockImplementation(async (pattern: string) => {
            if (pattern.includes('csproj')) {
                return [];
            }
            return [stepsUri];
        });
        mockReadFile.mockImplementation(async () =>
            Buffer.from('using Reqnroll;\n[Binding]\npublic class SampleSteps { }')
        );

        const provider = new CSharpSpecflowProvider();
        const result = await provider.detect([folder as any]);

        expect(result.confidence).toBe(0);
        expect(result.reasons.some((r) => r.includes('Reqnroll'))).toBe(true);
    });

    it('detects SpecFlow-only project with positive confidence', async () => {
        const csprojUri = vscode.Uri.file('/workspace/App/App.csproj');
        const stepsUri = vscode.Uri.file('/workspace/StepDefinitions/LoginSteps.cs');

        mockFindFiles.mockImplementation(async (pattern: string) => {
            if (pattern.includes('csproj')) {
                return [csprojUri];
            }
            return [stepsUri];
        });
        mockReadFile.mockImplementation(async (uri: { fsPath: string }) => {
            if (uri.fsPath.endsWith('.csproj')) {
                return Buffer.from(SPECFLOW_CSPROJ);
            }
            return Buffer.from(SPECFLOW_STEPS);
        });

        const provider = new CSharpSpecflowProvider();
        const result = await provider.detect([folder as any]);

        expect(result.confidence).toBeGreaterThan(0);
    });
});
