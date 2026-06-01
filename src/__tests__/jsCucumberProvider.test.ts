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
import { JsCucumberProvider } from '../providers/bindings/jsCucumberProvider';

describe('JsCucumberProvider.detect', () => {
    beforeEach(() => {
        mockFindFiles.mockReset();
        mockReadFile.mockReset();
    });

    it('returns high confidence when @cucumber/cucumber is in package.json', async () => {
        const pkg = vscode.Uri.file('/workspace/package.json');
        mockFindFiles.mockResolvedValue([pkg]);
        mockReadFile.mockResolvedValue(
            Buffer.from(JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^11.0.0' } }))
        );

        const provider = new JsCucumberProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns 0 confidence when no package.json has cucumber dependency', async () => {
        const pkg = vscode.Uri.file('/workspace/package.json');
        mockFindFiles.mockResolvedValue([pkg]);
        mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify({ devDependencies: {} })));

        const provider = new JsCucumberProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBe(0);
    });
});

