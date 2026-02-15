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
import { Binding, ResolvedKeyword } from '../../core/domain';
import { compileBindingRegex } from '../../core/parsing/bindingRegex';

/**
 * Regex patterns for C# Reqnroll binding detection and parsing
 */
const PATTERNS = {
    // Detection patterns
    CSPROJ_REQNROLL: /PackageReference\s+Include\s*=\s*["']Reqnroll/i,
    BINDING_ATTRIBUTE: /\[Binding\]/,
    USING_REQNROLL: /using\s+Reqnroll/,
    
    // Parsing patterns
    // Inner string: [^"\\] | \. | "" (verbatim "" is one literal quote; allow so we capture full pattern)
    STEP_ATTRIBUTE: /\[(Given|When|Then)\s*\(\s*(@?"(?:[^"\\]|\\.|"")*")\s*\)\]/g,
    CLASS_NAME: /(?:public\s+)?(?:partial\s+)?class\s+(\w+)/,
    METHOD_NAME: /(?:public|private|protected|internal)\s+(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/,
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
        const bindings: Binding[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        const uri = document.uri;
        
        // Find class name
        const classMatch = text.match(PATTERNS.CLASS_NAME);
        const className = classMatch ? classMatch[1] : 'Unknown';
        
        // Find all step attributes
        let match: RegExpExecArray | null;
        const regex = new RegExp(PATTERNS.STEP_ATTRIBUTE.source, 'g');
        
        while ((match = regex.exec(text)) !== null) {
            const keyword = match[1] as ResolvedKeyword;
            const patternWithQuotes = match[2];
            
            // Extract pattern from quotes
            const patternRaw = this.extractPattern(patternWithQuotes);
            
            // Find line number
            const beforeMatch = text.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length - 1;
            
            // Find method name (search after the attribute)
            const afterAttribute = text.substring(match.index + match[0].length);
            const methodMatch = afterAttribute.match(PATTERNS.METHOD_NAME);
            const methodName = methodMatch ? methodMatch[1] : 'Unknown';
            
            // Compile regex
            const compiledRegex = compileBindingRegex(patternRaw, options.caseInsensitive);
            
            if (compiledRegex) {
                const binding: Binding = {
                    keyword,
                    patternRaw,
                    regex: compiledRegex,
                    className,
                    methodName,
                    uri,
                    range: new vscode.Range(lineNumber, 0, lineNumber, lines[lineNumber]?.length || 0),
                    lineNumber,
                    signature: `${className}.${methodName}`,
                };
                
                bindings.push(binding);
            }
        }
        
        return bindings;
    }
    
    /**
     * Extract pattern string from C# string literal (handles verbatim and regular strings).
     */
    private extractPattern(quotedString: string): string {
        // Remove outer quotes
        let pattern = quotedString;
        
        if (pattern.startsWith('@"')) {
            // Verbatim string: @"..." - double quotes become single
            pattern = pattern.slice(2, -1).replace(/""/g, '"');
        } else if (pattern.startsWith('"')) {
            // Regular string: "..." - handle escape sequences
            pattern = pattern.slice(1, -1)
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t');
        }
        
        return pattern;
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
