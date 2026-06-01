/**
 * JavaScript/TypeScript Cucumber.js Binding Provider (MVP)
 *
 * Detects @cucumber/cucumber in package.json and indexes step definitions.
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
import { parseJsCucumberBindingsFromText } from '../../core/parsing/jsCucumberBindingParser';

export class JsCucumberProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'js-cucumber';
    public readonly displayName = 'JavaScript Cucumber';
    public readonly bindingFileExtensions = ['.js', '.ts', '.mjs', '.cjs'];
    // Wide glob; we filter aggressively in parseFile (must reference @cucumber/cucumber).
    // This keeps MVP working across common repo layouts without requiring config.
    public readonly bindingGlob = '**/*.{js,ts,mjs,cjs}';
    
    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }

        const reasons: string[] = [];
        const signals: string[] = [];

        try {
            const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 20);
            for (const pkgUri of packageJsonFiles) {
                try {
                    const content = await this.readFileContent(pkgUri);
                    if (this.hasCucumberDependency(content)) {
                        signals.push(`Found @cucumber/cucumber in ${vscode.workspace.asRelativePath(pkgUri)}`);
                        reasons.push('Found @cucumber/cucumber in package.json');
                        return createDetectionResult(0.9, reasons, signals, ['javascript', 'typescript']);
                    }
                } catch {
                    // skip
                }
            }
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }

        reasons.push('No @cucumber/cucumber dependency found');
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
                    console.warn(`[JsCucumberProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        return bindings;
    }
    
    parseFile(
        document: vscode.TextDocument,
        options?: BindingIndexOptions
    ): Binding[] {
        return parseJsCucumberBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options?.caseInsensitive,
        });
    }

    private hasCucumberDependency(packageJsonText: string): boolean {
        // Fast string check first.
        if (!packageJsonText.includes('@cucumber/cucumber')) {
            return false;
        }
        try {
            const json = JSON.parse(packageJsonText) as any;
            const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
            return Boolean(deps['@cucumber/cucumber']);
        } catch {
            // If JSON is invalid, still treat as signal if string is present.
            return true;
        }
    }

    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

let instance: JsCucumberProvider | null = null;

export function getJsCucumberProvider(): JsCucumberProvider {
    if (!instance) {
        instance = new JsCucumberProvider();
    }
    return instance;
}
