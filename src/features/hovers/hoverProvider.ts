/**
 * Hover Provider - Shows binding details on step hover.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { ResolvedKeyword } from '../../core/domain';

export class HoverProvider implements vscode.HoverProvider {
    constructor(private indexManager: IndexManager) {}
    
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | null {
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
        
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            return null;
        }
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);
        
        const step = {
            keywordOriginal: keyword as any,
            keywordResolved: this.resolveKeyword(keyword),
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
        
        // Build hover content
        const contents = new vscode.MarkdownString();
        contents.isTrusted = true;
        
        if (result.status === 'unbound') {
            contents.appendMarkdown('### $(error) No Binding Found\n\n');
            contents.appendMarkdown(`No C# step binding matches:\n\`\`\`\n${text}\n\`\`\`\n`);
        } else if (result.status === 'ambiguous') {
            contents.appendMarkdown('### $(warning) Ambiguous Binding\n\n');
            contents.appendMarkdown(`Multiple bindings match this step:\n\n`);
            
            for (const candidate of result.candidates.slice(0, 5)) {
                const binding = candidate.binding;
                contents.appendMarkdown(
                    `- **${binding.methodName}** (score: ${candidate.score})\n` +
                    `  - File: \`${binding.uri.fsPath.split('/').slice(-2).join('/')}\`\n` +
                    `  - Pattern: \`${binding.patternRaw}\`\n\n`
                );
            }
            
            if (result.candidates.length > 5) {
                contents.appendMarkdown(`_...and ${result.candidates.length - 5} more_\n`);
            }
        } else {
            const best = result.best!;
            const binding = best.binding;
            
            contents.appendMarkdown('### $(symbol-method) Step Binding\n\n');
            contents.appendMarkdown(`**Method:** \`${binding.className}.${binding.methodName}\`\n\n`);
            contents.appendMarkdown(`**Pattern:**\n\`\`\`csharp\n[${binding.keyword}(@"${binding.patternRaw}")]\n\`\`\`\n\n`);
            contents.appendMarkdown(`**File:** \`${binding.uri.fsPath.split('/').slice(-2).join('/')}\` (line ${binding.lineNumber + 1})\n\n`);
            contents.appendMarkdown(`**Score:** ${best.score}\n`);
            
            if (result.candidates.length > 1) {
                contents.appendMarkdown(`\n_+${result.candidates.length - 1} other candidate(s)_\n`);
            }
        }
        
        return new vscode.Hover(contents, new vscode.Range(position.line, 0, position.line, line.length));
    }
    
    private resolveKeyword(keyword: string): ResolvedKeyword {
        const lower = keyword.toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
        return 'Given';
    }
}

/**
 * Create and register the hover provider.
 */
export function createHoverProvider(indexManager: IndexManager): vscode.Disposable {
    const provider = new HoverProvider(indexManager);
    
    // Register for multiple selectors to ensure .feature files are handled
    const selectors: vscode.DocumentSelector = [
        { language: 'gherkin', scheme: 'file' },
        { language: 'feature', scheme: 'file' },
        { language: 'cucumber', scheme: 'file' },
        { pattern: '**/*.feature', scheme: 'file' },
    ];
    
    return vscode.languages.registerHoverProvider(selectors, provider);
}
