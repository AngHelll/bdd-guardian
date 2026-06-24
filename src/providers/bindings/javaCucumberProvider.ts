/**
 * Java Cucumber-JVM Binding Provider (MVP)
 *
 * Detects io.cucumber in Maven/Gradle and indexes @Given/@When/@Then annotations.
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
import { parseJavaCucumberBindingsFromText } from '../../core/parsing/javaCucumberBindingParser';

const DEP_FILE_EXCLUDE =
    '{**/target/**,**/.gradle/**,**/node_modules/**,**/.mvn/**,**/build/**}';

export class JavaCucumberProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'java-cucumber';
    public readonly displayName = 'Java Cucumber';
    public readonly bindingFileExtensions = ['.java'];
    public readonly bindingGlob =
        '{' +
        'src/test/java/**/*.java,' +
        '**/stepdefs/**/*.java,' +
        '**/steps/**/*.java,' +
        '**/*Steps.java,' +
        '**/*StepDefinitions.java' +
        '}';

    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }

        const reasons: string[] = [];
        const signals: string[] = [];

        try {
            const depPatterns = [
                '**/pom.xml',
                '**/build.gradle',
                '**/build.gradle.kts',
            ] as const;

            for (const pattern of depPatterns) {
                const files = await vscode.workspace.findFiles(pattern, DEP_FILE_EXCLUDE, 20);
                for (const fileUri of files) {
                    try {
                        const content = await this.readFileContent(fileUri);
                        if (this.declaresCucumberJvmDependency(content, fileUri.fsPath)) {
                            const rel = vscode.workspace.asRelativePath(fileUri);
                            signals.push(`Found io.cucumber in ${rel}`);
                            reasons.push(`Found io.cucumber in ${pattern.replace('**/', '')}`);
                            return createDetectionResult(0.9, reasons, signals, ['java']);
                        }
                    } catch {
                        // skip unreadable file
                    }
                }
            }
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }

        reasons.push('No io.cucumber dependency found in pom.xml or build.gradle');
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
                    console.warn(`[JavaCucumberProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        return bindings;
    }

    parseFile(document: vscode.TextDocument, options?: BindingIndexOptions): Binding[] {
        return parseJavaCucumberBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options?.caseInsensitive,
        });
    }

    private declaresCucumberJvmDependency(content: string, filePath: string): boolean {
        if (!/io\.cucumber/.test(content)) {
            return false;
        }

        const base = filePath.split(/[/\\]/).pop() ?? filePath;

        if (base === 'pom.xml') {
            return (
                /<groupId>\s*io\.cucumber\s*<\/groupId>/i.test(content) ||
                /io\.cucumber:cucumber-(java|junit|bom)/i.test(content)
            );
        }

        if (base === 'build.gradle' || base === 'build.gradle.kts') {
            return (
                /['"]io\.cucumber:cucumber-(java|junit)/i.test(content) ||
                /io\.cucumber\s*[:('"](cucumber-java|cucumber-junit)/i.test(content)
            );
        }

        return false;
    }

    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

let instance: JavaCucumberProvider | null = null;

export function getJavaCucumberProvider(): JavaCucumberProvider {
    if (!instance) {
        instance = new JavaCucumberProvider();
    }
    return instance;
}
