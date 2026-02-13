/**
 * Hover Provider - Shows enriched binding details on step hover.
 * 
 * Phase 4: Enhanced with:
 * - Code preview of the binding method
 * - Captured parameters from regex
 * - Clickable navigation links
 * - Scenario Outline placeholder support
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { ResolvedKeyword, Binding, MatchCandidate } from '../../core/domain';

// Placeholder regex for Scenario Outline detection
const PLACEHOLDER_REGEX = /<([^>]+)>/g;

// Cache for code previews to avoid repeated file reads
const codePreviewCache = new Map<string, { code: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export class HoverProvider implements vscode.HoverProvider {
    constructor(private indexManager: IndexManager) {}
    
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
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
            return this.createNoIndexHover(position, line);
        }
        
        // Check if we're in a Scenario Outline and get Examples
        const examples = this.getExamplesForPosition(document, position.line);
        const candidateTexts = this.generateCandidateTexts(text, examples);
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);
        
        // Resolve keyword for And/But
        const resolvedKeyword = this.resolveKeywordWithContext(document, position.line, keyword);
        
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
            isOutline: examples.length > 0,
            candidateTexts: candidateTexts,
        };
        
        const result = resolve(step as any);
        
        // Build enriched hover content
        const contents = new vscode.MarkdownString();
        contents.isTrusted = true;
        contents.supportHtml = true;
        
        if (result.status === 'unbound') {
            await this.buildUnboundHover(contents, text, candidateTexts);
        } else if (result.status === 'ambiguous') {
            await this.buildAmbiguousHover(contents, [...result.candidates], text);
        } else {
            await this.buildBoundHover(contents, result.best!, text);
        }
        
        return new vscode.Hover(contents, new vscode.Range(position.line, 0, position.line, line.length));
    }
    
    /**
     * Build hover content for unbound steps
     */
    private async buildUnboundHover(
        contents: vscode.MarkdownString,
        stepText: string,
        candidateTexts: string[]
    ): Promise<void> {
        contents.appendMarkdown('## ❌ No Binding Found\n\n');
        contents.appendMarkdown('No C# step binding matches this step.\n\n');
        
        contents.appendMarkdown('**Step text:**\n');
        contents.appendMarkdown('```gherkin\n' + stepText + '\n```\n\n');
        
        if (candidateTexts.length > 1) {
            contents.appendMarkdown('**Expanded variants tried:**\n');
            for (const candidate of candidateTexts.slice(0, 3)) {
                contents.appendMarkdown('- `' + candidate + '`\n');
            }
            if (candidateTexts.length > 3) {
                contents.appendMarkdown('- _...and ' + (candidateTexts.length - 3) + ' more_\n');
            }
            contents.appendMarkdown('\n');
        }
        
        // Suggest creating a binding
        const suggestedPattern = this.suggestBindingPattern(stepText);
        contents.appendMarkdown('**Suggested binding:**\n');
        contents.appendMarkdown('```csharp\n');
        contents.appendMarkdown('[When(@"' + suggestedPattern + '")]\n');
        contents.appendMarkdown('public void WhenStep()\n');
        contents.appendMarkdown('{\n    // TODO: Implement step\n}\n');
        contents.appendMarkdown('```\n');
    }
    
    /**
     * Build hover content for ambiguous steps
     */
    private async buildAmbiguousHover(
        contents: vscode.MarkdownString,
        candidates: MatchCandidate[],
        stepText: string
    ): Promise<void> {
        contents.appendMarkdown('## ⚠️ Ambiguous Binding\n\n');
        contents.appendMarkdown(`**${candidates.length} bindings** match this step:\n\n`);
        
        for (const candidate of candidates.slice(0, 5)) {
            const binding = candidate.binding;
            const relativePath = vscode.workspace.asRelativePath(binding.uri);
            
            contents.appendMarkdown('---\n\n');
            contents.appendMarkdown(`### ${binding.methodName}\n\n`);
            contents.appendMarkdown(`📁 \`${relativePath}\` (line ${binding.lineNumber + 1})\n\n`);
            contents.appendMarkdown(`**Pattern:** \`${binding.patternRaw}\`\n\n`);
            contents.appendMarkdown(`**Score:** ${candidate.score}\n\n`);
            
            // Show captured parameters
            const captures = this.extractCaptures(stepText, binding);
            if (captures.length > 0) {
                contents.appendMarkdown('**Captured values:**\n');
                for (const cap of captures) {
                    contents.appendMarkdown(`- \`${cap}\`\n`);
                }
                contents.appendMarkdown('\n');
            }
        }
        
        if (candidates.length > 5) {
            contents.appendMarkdown(`\n_...and ${candidates.length - 5} more matches_\n`);
        }
    }
    
    /**
     * Build hover content for bound steps (main case)
     */
    private async buildBoundHover(
        contents: vscode.MarkdownString,
        candidate: MatchCandidate,
        stepText: string
    ): Promise<void> {
        const binding = candidate.binding;
        const relativePath = vscode.workspace.asRelativePath(binding.uri);
        
        contents.appendMarkdown('## ✅ Step Binding\n\n');
        
        // Method signature
        contents.appendMarkdown(`**${binding.className}.**\`${binding.methodName}\`\n\n`);
        
        // File location with link
        const fileLink = `[${relativePath}:${binding.lineNumber + 1}](${binding.uri.toString()}#L${binding.lineNumber + 1})`;
        contents.appendMarkdown(`📁 ${fileLink}\n\n`);
        
        // Pattern
        contents.appendMarkdown('**Pattern:**\n');
        contents.appendMarkdown('```csharp\n');
        contents.appendMarkdown(`[${binding.keyword}(@"${binding.patternRaw}")]\n`);
        contents.appendMarkdown('```\n\n');
        
        // Captured parameters
        const captures = this.extractCaptures(stepText, binding);
        if (captures.length > 0) {
            contents.appendMarkdown('**Captured parameters:**\n');
            contents.appendMarkdown('| # | Value |\n');
            contents.appendMarkdown('|---|-------|\n');
            captures.forEach((cap, idx) => {
                contents.appendMarkdown(`| ${idx + 1} | \`${cap}\` |\n`);
            });
            contents.appendMarkdown('\n');
        }
        
        // Code preview
        const codePreview = await this.getCodePreview(binding);
        if (codePreview) {
            contents.appendMarkdown('**Code preview:**\n');
            contents.appendMarkdown('```csharp\n');
            contents.appendMarkdown(codePreview);
            contents.appendMarkdown('\n```\n');
        }
        
        // Match score
        contents.appendMarkdown(`\n---\n_Match score: ${candidate.score}_`);
    }
    
    /**
     * Create hover when no index is available
     */
    private createNoIndexHover(position: vscode.Position, line: string): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.isTrusted = true;
        contents.appendMarkdown('## ⏳ Indexing...\n\n');
        contents.appendMarkdown('Bindings are not yet indexed.\n\n');
        contents.appendMarkdown('[Reindex Workspace](command:reqnrollNavigator.reindex)');
        return new vscode.Hover(contents, new vscode.Range(position.line, 0, position.line, line.length));
    }
    
    /**
     * Extract captured values from step text using binding pattern
     */
    private extractCaptures(stepText: string, binding: Binding): string[] {
        const captures: string[] = [];
        
        try {
            if (binding.regex) {
                const match = binding.regex.exec(stepText);
                if (match && match.length > 1) {
                    for (let i = 1; i < match.length; i++) {
                        if (match[i] !== undefined) {
                            captures.push(match[i]);
                        }
                    }
                }
            }
        } catch {
            // Ignore regex errors
        }
        
        return captures;
    }
    
    /**
     * Get code preview for a binding method
     */
    private async getCodePreview(binding: Binding): Promise<string | null> {
        const cacheKey = `${binding.uri.toString()}:${binding.lineNumber}`;
        const cached = codePreviewCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.code;
        }
        
        try {
            const doc = await vscode.workspace.openTextDocument(binding.uri);
            const startLine = binding.lineNumber;
            const endLine = Math.min(startLine + 15, doc.lineCount - 1);
            
            const lines: string[] = [];
            let braceCount = 0;
            let foundStart = false;
            let methodLines = 0;
            
            for (let i = startLine; i <= endLine && methodLines < 12; i++) {
                const lineText = doc.lineAt(i).text;
                lines.push(lineText);
                methodLines++;
                
                // Track braces to find method end
                for (const char of lineText) {
                    if (char === '{') {
                        foundStart = true;
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (foundStart && braceCount === 0) {
                            // Method complete
                            const code = lines.join('\n');
                            codePreviewCache.set(cacheKey, { code, timestamp: Date.now() });
                            return code;
                        }
                    }
                }
            }
            
            // Return what we have if method didn't close
            if (lines.length > 0) {
                const code = lines.join('\n') + '\n    // ...';
                codePreviewCache.set(cacheKey, { code, timestamp: Date.now() });
                return code;
            }
        } catch {
            // File read error
        }
        
        return null;
    }
    
    /**
     * Suggest a binding pattern from step text
     */
    private suggestBindingPattern(stepText: string): string {
        // Replace quoted strings with capture groups
        let pattern = stepText
            .replace(/"([^"]+)"/g, '"(.*)"')
            .replace(/'([^']+)'/g, "'(.*)'");
        
        // Replace numbers with capture groups
        pattern = pattern.replace(/\b\d+\b/g, '(\\d+)');
        
        // Escape special regex characters (except our capture groups)
        pattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\?/g, '\\?')
            .replace(/\*/g, '\\*')
            .replace(/\+/g, '\\+')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');
        
        return pattern;
    }
    
    /**
     * Get Examples data for a position in a Scenario Outline
     */
    private getExamplesForPosition(
        document: vscode.TextDocument,
        lineNumber: number
    ): { headers: string[], rows: string[][] }[] {
        const examples: { headers: string[], rows: string[][] }[] = [];
        const lines = document.getText().split('\n');
        
        // Find if we're in a Scenario Outline
        let inScenarioOutline = false;
        let scenarioOutlineStart = -1;
        
        for (let i = lineNumber; i >= 0; i--) {
            if (/^\s*Scenario Outline:/i.test(lines[i])) {
                inScenarioOutline = true;
                scenarioOutlineStart = i;
                break;
            }
            if (/^\s*(Scenario|Feature):/i.test(lines[i])) {
                break;
            }
        }
        
        if (!inScenarioOutline) {
            return examples;
        }
        
        // Find Examples after the Scenario Outline
        let currentExample: { headers: string[], rows: string[][] } | null = null;
        
        for (let i = scenarioOutlineStart; i < lines.length; i++) {
            const line = lines[i];
            
            // Stop at next scenario
            if (i > scenarioOutlineStart && /^\s*(Scenario|Feature):/i.test(line)) {
                break;
            }
            
            if (/^\s*Examples:/i.test(line)) {
                currentExample = { headers: [], rows: [] };
                examples.push(currentExample);
            } else if (line.trim().startsWith('|') && currentExample) {
                const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
                if (currentExample.headers.length === 0) {
                    currentExample.headers = cells;
                } else {
                    currentExample.rows.push(cells);
                }
            }
        }
        
        return examples;
    }
    
    /**
     * Generate candidate texts by expanding placeholders
     */
    private generateCandidateTexts(
        stepText: string,
        examples: { headers: string[], rows: string[][] }[]
    ): string[] {
        const candidates: string[] = [];
        const normalizedText = stepText.replace(/\s+/g, ' ').trim();
        
        // Check for placeholders
        const hasPlaceholders = PLACEHOLDER_REGEX.test(normalizedText);
        PLACEHOLDER_REGEX.lastIndex = 0;
        
        // Fallback: replace placeholders with X
        const fallbackCandidate = normalizedText.replace(PLACEHOLDER_REGEX, 'X');
        candidates.push(fallbackCandidate);
        
        if (!hasPlaceholders || examples.length === 0) {
            return candidates;
        }
        
        // Expand with actual Example values
        for (const example of examples) {
            if (example.headers.length === 0) continue;
            
            const maxRows = Math.min(example.rows.length, 10);
            for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
                if (candidates.length >= 15) break;
                
                const row = example.rows[rowIdx];
                let expandedText = normalizedText;
                
                for (let colIdx = 0; colIdx < example.headers.length; colIdx++) {
                    const placeholder = `<${example.headers[colIdx]}>`;
                    const value = row[colIdx] ?? 'X';
                    expandedText = expandedText.split(placeholder).join(value);
                }
                
                expandedText = expandedText.replace(/\s+/g, ' ').trim();
                
                if (!candidates.includes(expandedText)) {
                    candidates.push(expandedText);
                }
            }
        }
        
        return candidates;
    }
    
    /**
     * Resolve And/But keyword by looking at previous steps
     */
    private resolveKeywordWithContext(
        document: vscode.TextDocument,
        lineNumber: number,
        keyword: string
    ): ResolvedKeyword {
        const lower = keyword.toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
        
        // For And/But, look backwards to find the previous Given/When/Then
        for (let i = lineNumber - 1; i >= 0; i--) {
            const line = document.lineAt(i).text;
            const match = line.match(/^\s*(Given|When|Then)\s+/i);
            if (match) {
                const prevKeyword = match[1].toLowerCase();
                if (prevKeyword === 'given') return 'Given';
                if (prevKeyword === 'when') return 'When';
                if (prevKeyword === 'then') return 'Then';
            }
            // Stop at scenario/feature boundary
            if (/^\s*(Scenario|Feature|Background):/i.test(line)) {
                break;
            }
        }
        
        return 'Given'; // Default fallback
    }
}

/**
 * Create and register the hover provider.
 */
export function createHoverProvider(indexManager: IndexManager): vscode.Disposable {
    const provider = new HoverProvider(indexManager);
    
    const selectors: vscode.DocumentSelector = [
        { language: 'gherkin', scheme: 'file' },
        { language: 'feature', scheme: 'file' },
        { language: 'cucumber', scheme: 'file' },
        { pattern: '**/*.feature', scheme: 'file' },
    ];
    
    return vscode.languages.registerHoverProvider(selectors, provider);
}
