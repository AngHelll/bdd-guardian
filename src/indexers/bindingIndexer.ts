/**
 * C# Binding File Indexer
 * Parses .cs files to extract Reqnroll step bindings
 * 
 * Features:
 * - Handles both verbatim (@"...") and regular ("...") strings
 * - Proper unescaping of C# string literals
 * - Whitespace normalization for consistent matching
 */

import * as vscode from 'vscode';
import {
    StepBinding,
    BindingFile,
    BindingIndex,
    ResolvedKeyword,
    getConfig,
    normalizeWhitespace,
} from '../types';

// Regex patterns for parsing C# bindings
// Matches: [Given(@"pattern")], [When("pattern")], [Then(@"pattern")]
const BINDING_ATTRIBUTE_REGEX = /\[(Given|When|Then)\s*\(\s*(@?"(?:[^"\\]|\\.)*")\s*\)\]/g;
const CLASS_REGEX = /(?:public|internal|private)?\s*(?:partial\s+)?class\s+(\w+)/g;
const METHOD_REGEX = /(?:public|private|protected|internal)?\s*(?:async\s+)?(?:Task|void)\s+(\w+)\s*\(/g;

export class BindingIndexer {
    private index: BindingIndex = {
        files: new Map(),
        allBindings: [],
        byKeyword: new Map([
            ['Given', []],
            ['When', []],
            ['Then', []],
        ]),
        lastIndexed: new Date(0),
    };

    /**
     * Get the current binding index
     */
    public getIndex(): BindingIndex {
        return this.index;
    }

    /**
     * Index all C# files in the workspace
     */
    public async indexAll(): Promise<void> {
        const config = getConfig();
        const csFiles = await vscode.workspace.findFiles(
            config.bindingsGlob,
            `{${config.excludePatterns.join(',')}}`
        );

        this.index.files.clear();
        this.index.allBindings = [];
        this.index.byKeyword = new Map([
            ['Given', []],
            ['When', []],
            ['Then', []],
        ]);

        for (const uri of csFiles) {
            await this.indexFile(uri);
        }

        this.index.lastIndexed = new Date();
        console.log(`[Reqnroll Navigator] Indexed ${this.index.allBindings.length} bindings from ${this.index.files.size} files`);
    }

    /**
     * Index a single C# file
     */
    public async indexFile(uri: vscode.Uri): Promise<BindingFile | undefined> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();

            // Quick check: skip files without binding attributes
            if (!content.includes('[Given') && !content.includes('[When') && !content.includes('[Then')) {
                return undefined;
            }

            // Also check for [Binding] attribute
            if (!content.includes('[Binding]')) {
                return undefined;
            }

            const bindingFile = this.parseBindingFile(document);
            
            if (bindingFile && bindingFile.bindings.length > 0) {
                // Remove old bindings from this file
                this.removeFile(uri);
                
                // Add new bindings
                this.index.files.set(uri.toString(), bindingFile);
                
                for (const binding of bindingFile.bindings) {
                    this.index.allBindings.push(binding);
                    const keywordBindings = this.index.byKeyword.get(binding.keyword);
                    if (keywordBindings) {
                        keywordBindings.push(binding);
                    }
                }
            }
            
            return bindingFile;
        } catch (error) {
            console.error(`[Reqnroll Navigator] Error indexing ${uri.fsPath}:`, error);
            return undefined;
        }
    }

    /**
     * Remove a file from the index
     */
    public removeFile(uri: vscode.Uri): void {
        const uriString = uri.toString();
        const existingFile = this.index.files.get(uriString);
        
        if (existingFile) {
            // Remove bindings from allBindings
            this.index.allBindings = this.index.allBindings.filter(
                (b: StepBinding) => b.uri.toString() !== uriString
            );
            
            // Remove from byKeyword
            for (const keyword of ['Given', 'When', 'Then'] as ResolvedKeyword[]) {
                const bindings = this.index.byKeyword.get(keyword);
                if (bindings) {
                    this.index.byKeyword.set(
                        keyword,
                        bindings.filter((b: StepBinding) => b.uri.toString() !== uriString)
                    );
                }
            }
            
            this.index.files.delete(uriString);
        }
    }

    /**
     * Parse a C# file for bindings
     */
    private parseBindingFile(document: vscode.TextDocument): BindingFile {
        const content = document.getText();
        const lines = content.split('\n');
        const bindings: StepBinding[] = [];
        const classNames: string[] = [];
        
        let currentClassName = 'Unknown';
        
        // Find class names
        let classMatch;
        CLASS_REGEX.lastIndex = 0;
        while ((classMatch = CLASS_REGEX.exec(content)) !== null) {
            classNames.push(classMatch[1]);
        }

        // Parse line by line for better position tracking
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            
            // Update current class (simple heuristic)
            const classLineMatch = line.match(/(?:public|internal|private)?\s*(?:partial\s+)?class\s+(\w+)/);
            if (classLineMatch) {
                currentClassName = classLineMatch[1];
            }

            // Find binding attributes on this line
            BINDING_ATTRIBUTE_REGEX.lastIndex = 0;
            let bindingMatch;
            while ((bindingMatch = BINDING_ATTRIBUTE_REGEX.exec(line)) !== null) {
                const keyword = bindingMatch[1] as ResolvedKeyword;
                const rawPattern = bindingMatch[2];
                
                // Extract pattern string (remove @ and outer quotes)
                const patternRaw = this.extractPatternString(rawPattern);
                
                // Find method name (usually on next non-attribute line)
                const methodName = this.findMethodName(lines, lineNum);
                
                // Compile regex
                const regex = this.compileBindingRegex(patternRaw);
                
                if (regex) {
                    const binding: StepBinding = {
                        keyword,
                        patternRaw,
                        regex,
                        className: currentClassName,
                        methodName,
                        uri: document.uri,
                        range: new vscode.Range(lineNum, bindingMatch.index || 0, lineNum, line.length),
                        lineNumber: lineNum,
                        methodSignature: `${currentClassName}.${methodName}`,
                    };
                    
                    bindings.push(binding);
                }
            }
        }

        return {
            uri: document.uri,
            bindings,
            classNames,
        };
    }

    /**
     * Extract the pattern string from a raw attribute value
     * Handles both @"..." (verbatim) and "..." (regular) strings with proper unescaping
     * 
     * Verbatim strings (@"..."):
     * - Only "" needs to be converted to "
     * - Backslash is literal (no escape processing)
     * 
     * Regular strings ("..."):
     * - \" -> "
     * - \\ -> \
     * - \n, \r, \t are processed
     */
    private extractPatternString(raw: string): string {
        let pattern = raw.trim();
        const isVerbatim = pattern.startsWith('@');
        
        // Remove leading @ if present
        if (isVerbatim) {
            pattern = pattern.substring(1);
        }
        
        // Remove outer quotes
        if (pattern.startsWith('"') && pattern.endsWith('"')) {
            pattern = pattern.substring(1, pattern.length - 1);
        }
        
        if (isVerbatim) {
            // Verbatim string: only "" needs to be converted to "
            // Backslashes are literal - do NOT process them
            pattern = pattern.replace(/""/g, '"');
        } else {
            // Regular string: process escape sequences
            // Order matters: process \\ first to avoid double processing
            pattern = pattern
                .replace(/\\\\/g, '\x00BACKSLASH\x00')  // Temporarily mark escaped backslashes
                .replace(/\\"/g, '"')                    // Escaped quotes
                .replace(/\\n/g, '\n')                   // Newline
                .replace(/\\r/g, '\r')                   // Carriage return
                .replace(/\\t/g, '\t')                   // Tab
                .replace(/\x00BACKSLASH\x00/g, '\\');    // Restore backslashes
        }
        
        return pattern;
    }

    /**
     * Find the method name after binding attributes
     */
    private findMethodName(lines: string[], startLine: number): string {
        // Look at lines following the attribute for a method definition
        for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
            const line = lines[i];
            METHOD_REGEX.lastIndex = 0;
            const match = METHOD_REGEX.exec(line);
            if (match) {
                return match[1];
            }
        }
        return 'UnknownMethod';
    }

    /**
     * Compile a binding pattern into a JavaScript regex
     */
    private compileBindingRegex(patternRaw: string): RegExp | null {
        try {
            const config = getConfig();
            let pattern = patternRaw;
            
            // If pattern doesn't have ^ at start, add it
            if (!pattern.startsWith('^')) {
                pattern = '^' + pattern;
            }
            
            // If pattern doesn't have $ at end, add it
            if (!pattern.endsWith('$')) {
                pattern = pattern + '$';
            }
            
            // Create regex with optional case insensitivity
            const flags = config.caseInsensitive ? 'i' : '';
            return new RegExp(pattern, flags);
        } catch (error) {
            console.warn(`[Reqnroll Navigator] Invalid regex pattern: ${patternRaw}`, error);
            return null;
        }
    }

    /**
     * Get all bindings
     */
    public getAllBindings(): StepBinding[] {
        return this.index.allBindings;
    }

    /**
     * Get bindings by keyword
     */
    public getBindingsByKeyword(keyword: ResolvedKeyword): StepBinding[] {
        return this.index.byKeyword.get(keyword) || [];
    }

    /**
     * Get binding file by URI
     */
    public getBindingFileByUri(uri: vscode.Uri): BindingFile | undefined {
        return this.index.files.get(uri.toString());
    }
}
