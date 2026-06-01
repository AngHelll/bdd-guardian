/**
 * C# SpecFlow Binding Provider
 *
 * SpecFlow shares the same step-binding attribute model as Reqnroll.
 * Detection differs; parsing uses the shared C# binding parser.
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
import { parseCSharpBindingsFromText } from '../../core/parsing/csharpBindingParser';

const PATTERNS = {
    CSPROJ_SPECFLOW: /PackageReference\s+Include\s*=\s*["']SpecFlow/i,
    CSPROJ_REQNROLL: /PackageReference\s+Include\s*=\s*["']Reqnroll/i,
    BINDING_ATTRIBUTE: /\[Binding\]/,
    USING_SPECFLOW: /using\s+TechTalk\.SpecFlow/,
    USING_REQNROLL: /using\s+Reqnroll/,
};

export class CSharpSpecflowProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'csharp-specflow';
    public readonly displayName = 'C# SpecFlow';
    public readonly bindingFileExtensions = ['.cs'];
    public readonly bindingGlob = '**/*.cs';

    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }

        let confidence = 0;
        const reasons: string[] = [];
        const signals: string[] = [];

        try {
            const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/node_modules/**', 20);
            let hasSpecFlowRef = false;
            let hasReqnrollRef = false;

            for (const csproj of csprojFiles) {
                try {
                    const content = await this.readFileContent(csproj);
                    if (PATTERNS.CSPROJ_SPECFLOW.test(content)) {
                        hasSpecFlowRef = true;
                        signals.push(`Found SpecFlow PackageReference in ${vscode.workspace.asRelativePath(csproj)}`);
                    }
                    if (PATTERNS.CSPROJ_REQNROLL.test(content)) {
                        hasReqnrollRef = true;
                        signals.push(`Found Reqnroll PackageReference in ${vscode.workspace.asRelativePath(csproj)}`);
                    }
                } catch {
                    // skip
                }
            }

            if (hasReqnrollRef) {
                return createDetectionResult(
                    0,
                    ['Reqnroll project detected — SpecFlow provider not used (same binding model)'],
                    signals,
                    []
                );
            }

            if (hasSpecFlowRef) {
                confidence += 0.5;
                reasons.push('Found SpecFlow PackageReference in .csproj');
            }

            let csFiles = await vscode.workspace.findFiles('**/*Steps*/**/*.cs', '{**/node_modules/**,**/bin/**,**/obj/**}', 30);
            if (csFiles.length === 0) {
                csFiles = await vscode.workspace.findFiles('**/*.cs', '{**/node_modules/**,**/bin/**,**/obj/**}', 50);
            }

            let hasBindingAttribute = false;
            let hasUsingSpecFlow = false;
            let hasUsingReqnroll = false;
            const sampleSize = Math.min(csFiles.length, 30);

            for (const csFile of csFiles.slice(0, sampleSize)) {
                try {
                    const content = await this.readFileContent(csFile);
                    if (!hasUsingReqnroll && PATTERNS.USING_REQNROLL.test(content)) {
                        hasUsingReqnroll = true;
                        signals.push(`Found "using Reqnroll" in ${vscode.workspace.asRelativePath(csFile)}`);
                    }
                    if (!hasBindingAttribute && PATTERNS.BINDING_ATTRIBUTE.test(content)) {
                        hasBindingAttribute = true;
                        signals.push(`Found [Binding] in ${vscode.workspace.asRelativePath(csFile)}`);
                    }
                    if (!hasUsingSpecFlow && PATTERNS.USING_SPECFLOW.test(content)) {
                        hasUsingSpecFlow = true;
                        signals.push(`Found "using TechTalk.SpecFlow" in ${vscode.workspace.asRelativePath(csFile)}`);
                    }
                    if (hasBindingAttribute && hasUsingSpecFlow) {
                        break;
                    }
                } catch {
                    // skip
                }
            }

            if (hasUsingReqnroll) {
                return createDetectionResult(
                    0,
                    ['Reqnroll project detected — SpecFlow provider not used (same binding model)'],
                    signals,
                    []
                );
            }

            if (hasBindingAttribute && (hasSpecFlowRef || hasUsingSpecFlow)) {
                confidence += 0.3;
                reasons.push('Found [Binding] attribute in C# files');
            } else if (hasBindingAttribute) {
                signals.push('Found [Binding] (ignored without SpecFlow package or using)');
            }
            if (hasUsingSpecFlow) {
                confidence += 0.2;
                reasons.push('Found TechTalk.SpecFlow using statement');
            }
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }

        if (confidence === 0) {
            reasons.push('No SpecFlow signals detected');
        }

        return createDetectionResult(
            confidence,
            reasons,
            signals,
            confidence > 0 ? ['csharp'] : []
        );
    }

    async indexBindings(
        files: readonly vscode.Uri[],
        options: BindingIndexOptions = {}
    ): Promise<Binding[]> {
        const bindings: Binding[] = [];
        for (const uri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                bindings.push(...this.parseFile(document, options));
            } catch (error) {
                if (options.debug) {
                    console.warn(`[CSharpSpecflowProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        return bindings;
    }

    parseFile(document: vscode.TextDocument, options: BindingIndexOptions = {}): Binding[] {
        return parseCSharpBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options.caseInsensitive,
        });
    }

    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

let instance: CSharpSpecflowProvider | null = null;

export function getCSharpSpecflowProvider(): CSharpSpecflowProvider {
    if (!instance) {
        instance = new CSharpSpecflowProvider();
    }
    return instance;
}
