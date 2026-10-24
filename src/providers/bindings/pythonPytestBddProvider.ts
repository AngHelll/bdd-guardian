/**
 * Python pytest-bdd Binding Provider
 *
 * Detects pytest-bdd and indexes @given / @when / @then string steps.
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
import { parsePythonPytestBddBindingsFromText } from '../../core/parsing/pythonPytestBddBindingParser';

const DEP_FILE_EXCLUDE = '{**/.venv/**,**/venv/**,**/node_modules/**,**/__pycache__/**}';

const PYTEST_BDD_IMPORT_REGEX = /from\s+pytest_bdd\s+import|import\s+pytest_bdd\b/;

export function declaresPytestBddDependency(content: string, pattern: string): boolean {
    if (pattern.endsWith('requirements.txt') || pattern.includes('requirements/')) {
        return /^\s*pytest-bdd(?:\[[^\]]*\])?(?:[=<>!~\s]|$)/m.test(content);
    }
    if (pattern.endsWith('pyproject.toml')) {
        return /["']pytest-bdd["']|pytest-bdd\s*[=<>!~]/.test(content);
    }
    if (pattern.endsWith('setup.py')) {
        return /['"]pytest-bdd['"]/.test(content) || /install_requires[\s\S]*pytest-bdd/.test(content);
    }
    return false;
}

export class PythonPytestBddProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'python-pytestbdd';
    public readonly displayName = 'Python pytest-bdd';
    public readonly bindingFileExtensions = ['.py'];
    public readonly bindingGlob =
        '{' +
        '**/step_defs/**/*.py,' +
        '**/steps/**/*.py,' +
        '**/*_steps.py' +
        '}';

    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }

        const reasons: string[] = [];
        const signals: string[] = [];

        try {
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
                        if (declaresPytestBddDependency(content, pattern)) {
                            signals.push(
                                `Found pytest-bdd in ${vscode.workspace.asRelativePath(fileUri)}`
                            );
                            reasons.push(`Found pytest-bdd in ${pattern.replace('**/', '')}`);
                            return createDetectionResult(0.9, reasons, signals, ['python']);
                        }
                    } catch {
                        // skip
                    }
                }
            }

            const pyFiles = await vscode.workspace.findFiles(
                this.bindingGlob,
                DEP_FILE_EXCLUDE,
                20
            );
            for (const fileUri of pyFiles) {
                try {
                    const content = await this.readFileContent(fileUri);
                    if (PYTEST_BDD_IMPORT_REGEX.test(content)) {
                        signals.push(
                            `Found pytest_bdd import in ${vscode.workspace.asRelativePath(fileUri)}`
                        );
                        reasons.push('Found pytest_bdd import');
                        return createDetectionResult(0.9, reasons, signals, ['python']);
                    }
                } catch {
                    // skip
                }
            }
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }

        reasons.push('No pytest-bdd package or import found');
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
                    console.warn(`[PythonPytestBddProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        return bindings;
    }

    parseFile(document: vscode.TextDocument, options?: BindingIndexOptions): Binding[] {
        return parsePythonPytestBddBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options?.caseInsensitive,
        });
    }

    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

let instance: PythonPytestBddProvider | null = null;

export function getPythonPytestBddProvider(): PythonPytestBddProvider {
    if (!instance) {
        instance = new PythonPytestBddProvider();
    }
    return instance;
}
