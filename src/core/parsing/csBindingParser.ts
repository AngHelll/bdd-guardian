/**
 * C# Binding Parser
 * Parses .cs files to extract Reqnroll step bindings
 */

import * as vscode from 'vscode';
import {
    BindingDocument,
    Binding,
    ResolvedKeyword,
} from '../domain/types';
import {
    BINDING_ATTRIBUTE_REGEX,
    CLASS_DECLARATION_REGEX,
    METHOD_DECLARATION_REGEX,
} from '../domain/constants';
import { compileBindingRegex } from './bindingRegex';

/**
 * Parse a C# file for Reqnroll bindings
 */
export function parseBindingDocument(document: vscode.TextDocument, caseInsensitive: boolean = false): BindingDocument | undefined {
    const content = document.getText();

    // Quick check: skip files without binding attributes
    if (!content.includes('[Given') && !content.includes('[When') && !content.includes('[Then')) {
        return undefined;
    }

    // Also check for [Binding] attribute
    if (!content.includes('[Binding]')) {
        return undefined;
    }

    const lines = content.split('\n');
    const bindings: Binding[] = [];
    const classNames: string[] = [];
    
    let currentClassName = 'Unknown';

    // Find class names
    let classMatch;
    const classRegex = new RegExp(CLASS_DECLARATION_REGEX.source, 'g');
    while ((classMatch = classRegex.exec(content)) !== null) {
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
        const bindingRegex = new RegExp(BINDING_ATTRIBUTE_REGEX.source, 'g');
        let bindingMatch;
        
        while ((bindingMatch = bindingRegex.exec(line)) !== null) {
            const keyword = bindingMatch[1] as ResolvedKeyword;
            const rawPattern = bindingMatch[2];
            
            // Extract pattern string (handle @"..." and "..." strings)
            const patternRaw = extractPatternString(rawPattern);
            
            // Find method name (usually on next non-attribute line)
            const methodName = findMethodName(lines, lineNum);
            
            // Compile regex
            const regex = compileBindingRegex(patternRaw, caseInsensitive);
            
            if (regex) {
                const binding: Binding = {
                    keyword,
                    patternRaw,
                    regex,
                    className: currentClassName,
                    methodName,
                    uri: document.uri,
                    range: new vscode.Range(lineNum, bindingMatch.index || 0, lineNum, line.length),
                    lineNumber: lineNum,
                    signature: `${currentClassName}.${methodName}`,
                };
                
                bindings.push(binding);
            }
        }
    }

    if (bindings.length === 0) {
        return undefined;
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
function extractPatternString(raw: string): string {
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
function findMethodName(lines: string[], startLine: number): string {
    const methodRegex = new RegExp(METHOD_DECLARATION_REGEX.source, 'g');
    
    // Look at lines following the attribute for a method definition
    for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
        const line = lines[i];
        methodRegex.lastIndex = 0;
        const match = methodRegex.exec(line);
        if (match) {
            return match[1];
        }
    }
    return 'UnknownMethod';
}
