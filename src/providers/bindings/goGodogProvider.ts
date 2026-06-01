/**
 * Go Godog Binding Provider (MVP)
 *
 * Detects github.com/cucumber/godog and indexes ctx.Step / Given / When / Then bindings.
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
import { parseGoGodogBindingsFromText } from '../../core/parsing/goGodogBindingParser';

const GODOG_MODULE = 'github.com/cucumber/godog';
const GO_MOD_EXCLUDE = '{**/vendor/**,**/node_modules/**}';
const GO_FILE_EXCLUDE = '{**/vendor/**,**/node_modules/**}';

export class GoGodogProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'go-godog';
    public readonly displayName = 'Go Godog';
    public readonly bindingFileExtensions = ['.go'];
    public readonly bindingGlob =
        '{' + '**/*_test.go,' + '**/features/**/*.go,' + '**/*_steps.go' + '}';

    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }

        const reasons: string[] = [];
        const signals: string[] = [];
        let confidence = 0;

        try {
            const goModFiles = await vscode.workspace.findFiles('**/go.mod', GO_MOD_EXCLUDE, 20);
            for (const modUri of goModFiles) {
                try {
                    const content = await this.readFileContent(modUri);
                    if (this.goModReferencesGodog(content)) {
                        signals.push(`Found ${GODOG_MODULE} in ${vscode.workspace.asRelativePath(modUri)}`);
                        reasons.push(`Found ${GODOG_MODULE} in go.mod`);
                        confidence = Math.max(confidence, 0.9);
                        break;
                    }
                } catch {
                    // skip
                }
            }

            if (confidence < 0.9) {
                const goFiles = await vscode.workspace.findFiles('**/*.go', GO_FILE_EXCLUDE, 40);
                const sample = goFiles.slice(0, 25);
                for (const goUri of sample) {
                    try {
                        const content = await this.readFileContent(goUri);
                        if (content.includes(GODOG_MODULE)) {
                            signals.push(
                                `Found ${GODOG_MODULE} import in ${vscode.workspace.asRelativePath(goUri)}`
                            );
                            reasons.push('Found godog import in .go file');
                            confidence = Math.max(confidence, 0.75);
                            break;
                        }
                    } catch {
                        // skip
                    }
                }
            }
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }

        if (confidence === 0) {
            reasons.push(`No ${GODOG_MODULE} found in go.mod or sampled .go files`);
            return createDetectionResult(0, reasons, signals, []);
        }

        return createDetectionResult(confidence, reasons, signals, ['go']);
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
                    console.warn(`[GoGodogProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        return bindings;
    }

    parseFile(document: vscode.TextDocument, options?: BindingIndexOptions): Binding[] {
        return parseGoGodogBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options?.caseInsensitive,
        });
    }

    private goModReferencesGodog(goModText: string): boolean {
        if (!goModText.includes('godog')) {
            return false;
        }
        return (
            goModText.includes(GODOG_MODULE) ||
            /\brequire\s+[^\n]*godog/.test(goModText) ||
            /\brequire\s*\([^)]*godog/s.test(goModText)
        );
    }

    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

let instance: GoGodogProvider | null = null;

export function getGoGodogProvider(): GoGodogProvider {
    if (!instance) {
        instance = new GoGodogProvider();
    }
    return instance;
}
