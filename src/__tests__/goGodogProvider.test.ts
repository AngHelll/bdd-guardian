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
import { GoGodogProvider } from '../providers/bindings/goGodogProvider';

describe('GoGodogProvider.detect', () => {
    beforeEach(() => {
        mockFindFiles.mockReset();
        mockReadFile.mockReset();
    });

    it('returns high confidence when go.mod requires godog', async () => {
        const mod = vscode.Uri.file('/workspace/go.mod');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/go.mod') return Promise.resolve([mod]);
            return Promise.resolve([]);
        });
        mockReadFile.mockResolvedValue(
            Buffer.from(
                'module example.com/demo\n\ngo 1.21\n\nrequire github.com/cucumber/godog v0.15.0\n'
            )
        );

        const provider = new GoGodogProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns 0 confidence when no godog signal', async () => {
        const mod = vscode.Uri.file('/workspace/go.mod');
        mockFindFiles.mockResolvedValue([mod]);
        mockReadFile.mockResolvedValue(Buffer.from('module example.com/demo\n\ngo 1.21\n'));

        const provider = new GoGodogProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBe(0);
    });
});
