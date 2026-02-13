/**
 * Definition Provider - Implements Go to Definition for Gherkin steps.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { ResolvedKeyword } from '../../core/domain';

export class DefinitionProvider implements vscode.DefinitionProvider {
    constructor(private indexManager: IndexManager) {}
    
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | null> {
        // Only process .feature files
        if (!document.fileName.endsWith('.feature')) {
            return null;
        }
        
        const line = document.lineAt(position.line).text;
        const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i);
        
        if (!stepMatch) {
            return null;
        }
        
        const keyword = stepMatch[1];
        const text = stepMatch[2].trim();
        
        // Get all bindings
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            return null;
        }
        
        // Build a simple step object for resolution
        const resolvedKeyword = this.normalizeKeyword(keyword);
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        
        const resolve = createResolver(deps);
        
        // Create a minimal step object
        const step = {
            keywordOriginal: keyword as any,
            keywordResolved: resolvedKeyword,
            rawText: text,
            normalizedText: text.replace(/\s+/g, ' ').trim(),
            fullText: line.trim(),
            tagsEffective: [],
            uri: document.uri,
            range: new vscode.Range(position.line, 0, position.line, line.length),
            lineNumber: position.line,
            isOutline: false,
            candidateTexts: [text],
        };
        
        const result = resolve(step as any);
        
        if (result.candidates.length === 0) {
            return null;
        }
        
        // Return all locations - VS Code will show peek if multiple
        return result.candidates.map(candidate => {
            return new vscode.Location(
                candidate.binding.uri,
                new vscode.Position(candidate.binding.lineNumber, 0)
            );
        });
    }
    
    /**
     * Normalize keyword (And/But -> Given as default).
     */
    private normalizeKeyword(keyword: string): ResolvedKeyword {
        const upper = keyword.toLowerCase();
        if (upper === 'given') return 'Given';
        if (upper === 'when') return 'When';
        if (upper === 'then') return 'Then';
        return 'Given';
    }
}

/**
 * Create and register the definition provider.
 */
export function createDefinitionProvider(
    indexManager: IndexManager
): vscode.Disposable {
    const provider = new DefinitionProvider(indexManager);
    
    // Register for multiple selectors to ensure .feature files are handled
    // regardless of whether VS Code recognizes them as 'gherkin' or 'feature'
    const selectors: vscode.DocumentSelector = [
        { language: 'gherkin', scheme: 'file' },
        { language: 'feature', scheme: 'file' },
        { language: 'cucumber', scheme: 'file' },
        { pattern: '**/*.feature', scheme: 'file' },
    ];
    
    return vscode.languages.registerDefinitionProvider(selectors, provider);
}
