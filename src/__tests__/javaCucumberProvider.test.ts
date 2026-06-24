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
import { JavaCucumberProvider } from '../providers/bindings/javaCucumberProvider';

describe('JavaCucumberProvider.detect', () => {
    beforeEach(() => {
        mockFindFiles.mockReset();
        mockReadFile.mockReset();
    });

    it('returns high confidence when pom.xml declares io.cucumber', async () => {
        const pom = vscode.Uri.file('/workspace/pom.xml');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/pom.xml') return Promise.resolve([pom]);
            return Promise.resolve([]);
        });
        mockReadFile.mockResolvedValue(
            Buffer.from(`
<dependency>
  <groupId>io.cucumber</groupId>
  <artifactId>cucumber-java</artifactId>
</dependency>
`)
        );

        const provider = new JavaCucumberProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.primaryLanguages).toContain('java');
    });

    it('returns high confidence when build.gradle declares cucumber-java', async () => {
        const gradle = vscode.Uri.file('/workspace/build.gradle');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/pom.xml') return Promise.resolve([]);
            if (pattern === '**/build.gradle') return Promise.resolve([gradle]);
            return Promise.resolve([]);
        });
        mockReadFile.mockResolvedValue(
            Buffer.from(`testImplementation 'io.cucumber:cucumber-java:7.18.0'`)
        );

        const provider = new JavaCucumberProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns 0 confidence when no cucumber signal', async () => {
        const pom = vscode.Uri.file('/workspace/pom.xml');
        mockFindFiles.mockImplementation((pattern: string) => {
            if (pattern === '**/pom.xml') return Promise.resolve([pom]);
            return Promise.resolve([]);
        });
        mockReadFile.mockResolvedValue(
            Buffer.from(`<dependency><groupId>junit</groupId><artifactId>junit</artifactId></dependency>`)
        );

        const provider = new JavaCucumberProvider();
        const result = await provider.detect([{ uri: vscode.Uri.file('/workspace') } as any]);
        expect(result.confidence).toBe(0);
    });
});
