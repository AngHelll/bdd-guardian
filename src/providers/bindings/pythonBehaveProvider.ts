/**
 * Python Behave Binding Provider (MVP)
 *
 * Detects behave in Python project files and indexes step definitions.
 */

import * as vscode from 'vscode';
import {
    IBindingProvider,
    BindingProviderId,
    DetectionResult,
    BindingIndexOptions,
    createDetectionResult,
} from './types';
import { Binding } from '../../core/domain';
import { parsePythonBehaveBindingsFromText } from '../../core/parsing/pythonBehaveBindingParser';

const DEP_FILE_EXCLUDE = '{**/.venv/**,**/venv/**,**/node_modules/**,**/__pycache__/**}';

export class PythonBehaveProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'python-behave';
    public readonly displayName = 'Python Behave';
    public readonly bindingFileExtensions = ['.py'];
    public readonly bindingGlob =
        '{' +
        '**/features/steps/**/*.py,' +
        '**/features/**/steps/**/*.py,' +
        '**/*_steps.py' +
        '}';

    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }

        const reasons: string[] = [];
        const signals: string[] = [];

        try {
            const behaveIniFiles = await vscode.workspace.findFiles(
                '**/behave.ini',
                DEP_FILE_EXCLUDE,
                10
            );
            if (behaveIniFiles.length > 0) {
                signals.push(
                    `Found behave.ini in ${vscode.workspace.asRelativePath(behaveIniFiles[0])}`
                );
                reasons.push('Found behave.ini configuration');
                return createDetectionResult(0.9, reasons, signals, ['python']);
            }

            const depPatterns = [
                '**/requirements.txt',
                '**/requirements/*.txt',
                '**/pyproject.toml',
                '**/setup.py',
            ] as const;

            for (const pattern of depPatterns) {
                const files = await vscode.workspace.findFiles(pattern, DEP_FILE_EXCLUDE, 15);
                for (const fileUri of files) {
                    try {
                        const content = await this.readFileContent(fileUri);
                        if (this.declaresBehaveDependency(content, pattern)) {
                            signals.push(
                                `Found behave in ${vscode.workspace.asRelativePath(fileUri)}`
                            );
                            reasons.push(`Found behave in ${pattern.replace('**/', '')}`);
                            return createDetectionResult(0.9, reasons, signals, ['python']);
                        }
                    } catch {
                        // skip
                    }
                }
            }
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }

        reasons.push('No behave package or behave.ini found');
        return createDetectionResult(0, reasons, signals, []);
    }

    async indexBindings(
        files: readonly vscode.Uri[],
        options?: BindingIndexOptions
    ): Promise<Binding[]> {
        const bindings: Binding[] = [];
        for (const uri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                bindings.push(...this.parseFile(document, options));
            } catch (error) {
                if (options?.debug) {
                    console.warn(`[PythonBehaveProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        return bindings;
    }

    parseFile(document: vscode.TextDocument, options?: BindingIndexOptions): Binding[] {
        return parsePythonBehaveBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options?.caseInsensitive,
        });
    }

    private declaresBehaveDependency(content: string, pattern: string): boolean {
        if (!/\bbehave\b/.test(content)) {
            return false;
        }
        if (pattern.endsWith('requirements.txt') || pattern.includes('requirements/')) {
            return /^\s*behave(?:[=<>!~\s]|$)/m.test(content);
        }
        if (pattern.endsWith('pyproject.toml')) {
            return /behave\s*[=<>!~]|["[]behave["\]]/.test(content);
        }
        if (pattern.endsWith('setup.py')) {
            return /['"]behave['"]/.test(content) || /install_requires[\s\S]*behave/.test(content);
        }
        return false;
    }

    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

let instance: PythonBehaveProvider | null = null;

export function getPythonBehaveProvider(): PythonBehaveProvider {
    if (!instance) {
        instance = new PythonBehaveProvider();
    }
    return instance;
}
