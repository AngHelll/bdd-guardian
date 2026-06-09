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
import { PythonBehaveProvider } from '../providers/bindings/pythonBehaveProvider';

describe('PythonBehaveProvider.detect', () => {
    beforeEach(() => {
        mockFindFiles.mockReset();
        mockReadFile.mockReset();
    });

    it('returns high confidence when behave is in requirements.txt', async () => {
        const req = vscode.Uri.file('/workspace/requirements.txt');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/behave.ini') return Promise.resolve([]);
            if (pattern === '**/requirements.txt') return Promise.resolve([req]);
            return Promise.resolve([]);
        });
        mockReadFile.mockResolvedValue(Buffer.from('behave==1.2.6\n'));

        const provider = new PythonBehaveProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns high confidence when behave.ini exists', async () => {
        const ini = vscode.Uri.file('/workspace/behave.ini');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/behave.ini') return Promise.resolve([ini]);
            return Promise.resolve([]);
        });

        const provider = new PythonBehaveProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns 0 confidence when no behave signal', async () => {
        const req = vscode.Uri.file('/workspace/requirements.txt');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/behave.ini') return Promise.resolve([]);
            if (pattern === '**/requirements.txt') return Promise.resolve([req]);
            return Promise.resolve([]);
        });
        mockReadFile.mockResolvedValue(Buffer.from('requests==2.0.0\n'));

        const provider = new PythonBehaveProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBe(0);
    });
});
