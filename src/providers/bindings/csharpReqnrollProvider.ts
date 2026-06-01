/**
 * C# Reqnroll Binding Provider
 * 
 * Full implementation for detecting and indexing Reqnroll step bindings.
 * This is the primary provider and serves as the reference implementation.
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

/**
 * Regex patterns for C# Reqnroll binding detection and parsing
 */
const PATTERNS = {
    CSPROJ_REQNROLL: /PackageReference\s+Include\s*=\s*["']Reqnroll/i,
    BINDING_ATTRIBUTE: /\[Binding\]/,
    USING_REQNROLL: /using\s+Reqnroll/,
};

/**
 * C# Reqnroll Binding Provider
 */
export class CSharpReqnrollProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'csharp-reqnroll';
    public readonly displayName = 'C# Reqnroll';
    public readonly bindingFileExtensions = ['.cs'];
    public readonly bindingGlob = '**/*.cs';
    
    /**
     * Detect Reqnroll usage in the workspace.
     * 
     * Signals:
     * - +0.5 if .csproj contains PackageReference to Reqnroll
     * - +0.3 if [Binding] attribute found in any .cs file
     * - +0.2 if "using Reqnroll" found
     */
    async detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        if (workspaceFolders.length === 0) {
            return createDetectionResult(0, ['No workspace folders']);
        }
        
        let confidence = 0;
        const reasons: string[] = [];
        const signals: string[] = [];
        
        try {
            // Check for .csproj with Reqnroll reference
            const csprojFiles = await vscode.workspace.findFiles('**/*.csproj', '**/node_modules/**', 20);
            let hasReqnrollRef = false;
            
            for (const csproj of csprojFiles) {
                try {
                    const content = await this.readFileContent(csproj);
                    if (PATTERNS.CSPROJ_REQNROLL.test(content)) {
                        hasReqnrollRef = true;
                        signals.push(`Found Reqnroll reference in ${vscode.workspace.asRelativePath(csproj)}`);
                        break;
                    }
                } catch {
                    // Skip unreadable files
                }
            }
            
            if (hasReqnrollRef) {
                confidence += 0.5;
                reasons.push('Found Reqnroll PackageReference in .csproj');
            }
            
            // Check for [Binding] attribute and using statement
            // First try to find files in Steps folders (most likely to have bindings)
            let csFiles = await vscode.workspace.findFiles('**/*Steps*/**/*.cs', '{**/node_modules/**,**/bin/**,**/obj/**}', 30);
            
            // If no Steps folders found, try general search
            if (csFiles.length === 0) {
                csFiles = await vscode.workspace.findFiles('**/*.cs', '{**/node_modules/**,**/bin/**,**/obj/**}', 50);
            }
            
            let hasBindingAttribute = false;
            let hasUsingReqnroll = false;
            
            // Sample files to check (don't read all)
            const sampleSize = Math.min(csFiles.length, 30);
            const sampledFiles = csFiles.slice(0, sampleSize);
            
            for (const csFile of sampledFiles) {
                try {
                    const content = await this.readFileContent(csFile);
                    
                    if (!hasBindingAttribute && PATTERNS.BINDING_ATTRIBUTE.test(content)) {
                        hasBindingAttribute = true;
                        signals.push(`Found [Binding] attribute in ${vscode.workspace.asRelativePath(csFile)}`);
                    }
                    
                    if (!hasUsingReqnroll && PATTERNS.USING_REQNROLL.test(content)) {
                        hasUsingReqnroll = true;
                        signals.push(`Found "using Reqnroll" in ${vscode.workspace.asRelativePath(csFile)}`);
                    }
                    
                    if (hasBindingAttribute && hasUsingReqnroll) {
                        break;
                    }
                } catch {
                    // Skip unreadable files
                }
            }
            
            if (hasBindingAttribute) {
                confidence += 0.3;
                reasons.push('Found [Binding] attribute in C# files');
            }
            
            if (hasUsingReqnroll) {
                confidence += 0.2;
                reasons.push('Found "using Reqnroll" statement');
            }
            
            // Check if any .feature files exist (needed for BDD)
            const featureFiles = await vscode.workspace.findFiles('**/*.feature', '**/node_modules/**', 1);
            if (featureFiles.length > 0) {
                signals.push('Found .feature files in workspace');
            }
            
        } catch (error) {
            reasons.push(`Detection error: ${error}`);
        }
        
        if (confidence === 0) {
            reasons.push('No Reqnroll signals detected');
        }
        
        return createDetectionResult(
            confidence,
            reasons,
            signals,
            confidence > 0 ? ['csharp'] : []
        );
    }
    
    /**
     * Index binding files and extract step definitions.
     */
    async indexBindings(
        files: readonly vscode.Uri[],
        options: BindingIndexOptions = {}
    ): Promise<Binding[]> {
        const bindings: Binding[] = [];
        
        for (const uri of files) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const fileBindings = this.parseFile(document, options);
                bindings.push(...fileBindings);
            } catch (error) {
                if (options.debug) {
                    console.warn(`[CSharpReqnrollProvider] Error indexing ${uri.fsPath}: ${error}`);
                }
            }
        }
        
        return bindings;
    }
    
    /**
     * Parse a single C# file for Reqnroll bindings.
     */
    parseFile(document: vscode.TextDocument, options: BindingIndexOptions = {}): Binding[] {
        return parseCSharpBindingsFromText(document.getText(), document.uri, {
            caseInsensitive: options.caseInsensitive,
        });
    }
    
    /**
     * Read file content as string.
     */
    private async readFileContent(uri: vscode.Uri): Promise<string> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }
}

/**
 * Singleton instance
 */
let instance: CSharpReqnrollProvider | null = null;

/**
 * Get the C# Reqnroll provider instance.
 */
export function getCSharpReqnrollProvider(): CSharpReqnrollProvider {
    if (!instance) {
        instance = new CSharpReqnrollProvider();
    }
    return instance;
}
