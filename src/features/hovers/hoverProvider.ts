/**
 * Hover Provider - Shows enriched binding details on step hover.
 * 
 * Features:
 * - Clean, minimal design native to VS Code
 * - Status at a glance
 * - Code preview on demand
 * - Captured parameters table
 * - Clickable navigation links
 * - Respects user configuration
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { ResolvedKeyword, Binding, MatchCandidate } from '../../core/domain';
import { 
    StepStatus, 
    getUIConfig, 
    getStatusEmoji, 
    getStatusLabel,
    formatBinding,
    sortCandidatesByScore 
} from '../../ui/stepStatus';

// Placeholder regex for Scenario Outline detection
const PLACEHOLDER_REGEX = /<([^>]+)>/g;

// Cache for code previews
const codePreviewCache = new Map<string, { code: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export class HoverProvider implements vscode.HoverProvider {
    constructor(private indexManager: IndexManager) {}
    
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Check if hover is enabled
        const uiConfig = getUIConfig();
        if (!uiConfig.hoverDetailsEnabled) {
            return null;
        }
        
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
            return this.createIndexingHover(position, line);
        }
        
        // Get Examples context for Scenario Outlines
        const examples = this.getExamplesForPosition(document, position.line);
        const candidateTexts = this.generateCandidateTexts(text, examples);
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);
        
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
        
        // Build hover content
        const contents = new vscode.MarkdownString();
        contents.isTrusted = true;
        contents.supportHtml = true;
        
        // Determine status
        let status: StepStatus;
        if (result.status === 'unbound') {
            status = StepStatus.Unbound;
        } else if (result.status === 'ambiguous') {
            status = StepStatus.Ambiguous;
        } else {
            status = StepStatus.Bound;
        }
        
        // Header with branding
        contents.appendMarkdown('#### BDD Guardian\n\n');
        contents.appendMarkdown(`**Status:** ${getStatusEmoji(status)} ${getStatusLabel(status)}\n\n`);
        contents.appendMarkdown('---\n\n');
        
        // Build content based on status
        if (status === StepStatus.Unbound) {
            await this.buildUnboundContent(contents, text);
        } else if (status === StepStatus.Ambiguous) {
            await this.buildAmbiguousContent(contents, [...result.candidates], text);
        } else {
            await this.buildBoundContent(contents, result.best!, text);
        }
        
        return new vscode.Hover(contents, new vscode.Range(position.line, 0, position.line, line.length));
    }
    
    /**
     * Build content for unbound steps.
     */
    private async buildUnboundContent(
        contents: vscode.MarkdownString,
        stepText: string
    ): Promise<void> {
        contents.appendMarkdown('No binding found for this step.\n\n');
        
        // Suggest creating a binding
        const suggestedPattern = this.suggestBindingPattern(stepText);
        contents.appendMarkdown('**Suggested binding:**\n');
        contents.appendMarkdown('```csharp\n');
        contents.appendMarkdown(`[When(@"${suggestedPattern}")]\n`);
        contents.appendMarkdown('public void Step() { }\n');
        contents.appendMarkdown('```\n');
    }
    
    /**
     * Build content for ambiguous steps (top 3 candidates).
     */
    private async buildAmbiguousContent(
        contents: vscode.MarkdownString,
        candidates: MatchCandidate[],
        stepText: string
    ): Promise<void> {
        const sorted = sortCandidatesByScore(candidates);
        const topCandidates = sorted.slice(0, 3);
        
        contents.appendMarkdown(`**${candidates.length} bindings** match this step:\n\n`);
        
        for (let i = 0; i < topCandidates.length; i++) {
            const candidate = topCandidates[i];
            const binding = candidate.binding;
            const relativePath = vscode.workspace.asRelativePath(binding.uri);
            const isBest = i === 0;
            
            if (isBest) {
                contents.appendMarkdown(`🏆 **Best match:**\n`);
            }
            
            contents.appendMarkdown(`- \`${binding.className}.${binding.methodName}\`\n`);
            contents.appendMarkdown(`  - File: \`${relativePath}:${binding.lineNumber + 1}\`\n`);
            contents.appendMarkdown(`  - Pattern: \`${this.truncate(binding.patternRaw, 40)}\`\n\n`);
        }
        
        if (candidates.length > 3) {
            contents.appendMarkdown(`_...and ${candidates.length - 3} more_\n\n`);
        }
        
        // Command link to show all
        contents.appendMarkdown('[Show all matches](command:reqnrollNavigator.showAmbiguousMatches)');
    }
    
    /**
     * Build content for bound steps.
     */
    private async buildBoundContent(
        contents: vscode.MarkdownString,
        candidate: MatchCandidate,
        stepText: string
    ): Promise<void> {
        const binding = candidate.binding;
        const relativePath = vscode.workspace.asRelativePath(binding.uri);
        
        // Binding info
        contents.appendMarkdown(`**Binding:** \`${binding.className}.${binding.methodName}\`\n\n`);
        contents.appendMarkdown(`**Pattern:** \`${binding.patternRaw}\`\n\n`);
        contents.appendMarkdown(`**File:** [${relativePath}:${binding.lineNumber + 1}](${binding.uri.toString()}#L${binding.lineNumber + 1})\n\n`);
        
        // Captured parameters
        const captures = this.extractCaptures(stepText, binding);
        if (captures.length > 0) {
            contents.appendMarkdown('**Captured:**\n');
            captures.forEach((cap, idx) => {
                contents.appendMarkdown(`- \`$${idx + 1}\` = \`${cap}\`\n`);
            });
            contents.appendMarkdown('\n');
        }
        
        // Code preview (compact)
        const codePreview = await this.getCodePreview(binding);
        if (codePreview) {
            contents.appendMarkdown('<details>\n<summary>Code preview</summary>\n\n');
            contents.appendMarkdown('```csharp\n');
            contents.appendMarkdown(codePreview);
            contents.appendMarkdown('\n```\n\n');
            contents.appendMarkdown('</details>\n');
        }
    }
    
    /**
     * Create hover when indexing is in progress.
     */
    private createIndexingHover(position: vscode.Position, line: string): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.isTrusted = true;
        contents.appendMarkdown('#### BDD Guardian\n\n');
        contents.appendMarkdown(`**Status:** ${getStatusEmoji(StepStatus.Indexing)} ${getStatusLabel(StepStatus.Indexing)}\n\n`);
        contents.appendMarkdown('---\n\n');
        contents.appendMarkdown('Bindings are being indexed...\n\n');
        contents.appendMarkdown('[Reindex Now](command:reqnrollNavigator.reindex)');
        return new vscode.Hover(contents, new vscode.Range(position.line, 0, position.line, line.length));
    }
    
    /**
     * Extract captured values from step text using binding pattern.
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
     * Get code preview for a binding method (cached).
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
            const endLine = Math.min(startLine + 10, doc.lineCount - 1);
            
            const lines: string[] = [];
            let braceCount = 0;
            let foundStart = false;
            
            for (let i = startLine; i <= endLine && lines.length < 8; i++) {
                const lineText = doc.lineAt(i).text;
                lines.push(lineText);
                
                for (const char of lineText) {
                    if (char === '{') {
                        foundStart = true;
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (foundStart && braceCount === 0) {
                            const code = lines.join('\n');
                            codePreviewCache.set(cacheKey, { code, timestamp: Date.now() });
                            return code;
                        }
                    }
                }
            }
            
            if (lines.length > 0) {
                const code = lines.join('\n') + '\n// ...';
                codePreviewCache.set(cacheKey, { code, timestamp: Date.now() });
                return code;
            }
        } catch {
            // File read error
        }
        
        return null;
    }
    
    /**
     * Suggest a binding pattern from step text.
     */
    private suggestBindingPattern(stepText: string): string {
        let pattern = stepText
            .replace(/"([^"]+)"/g, '"(.*)"')
            .replace(/'([^']+)'/g, "'(.*)'")
            .replace(/\b\d+\b/g, '(\\d+)')
            .replace(/\./g, '\\.')
            .replace(/\?/g, '\\?');
        
        return pattern;
    }
    
    /**
     * Truncate string for display.
     */
    private truncate(str: string, maxLength: number): string {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * Get Examples data for a position in a Scenario Outline.
     */
    private getExamplesForPosition(
        document: vscode.TextDocument,
        lineNumber: number
    ): { headers: string[], rows: string[][] }[] {
        const examples: { headers: string[], rows: string[][] }[] = [];
        const lines = document.getText().split('\n');
        
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
        
        let currentExample: { headers: string[], rows: string[][] } | null = null;
        
        for (let i = scenarioOutlineStart; i < lines.length; i++) {
            const line = lines[i];
            
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
     * Generate candidate texts by expanding placeholders.
     */
    private generateCandidateTexts(
        stepText: string,
        examples: { headers: string[], rows: string[][] }[]
    ): string[] {
        const candidates: string[] = [];
        const normalizedText = stepText.replace(/\s+/g, ' ').trim();
        
        const hasPlaceholders = PLACEHOLDER_REGEX.test(normalizedText);
        PLACEHOLDER_REGEX.lastIndex = 0;
        
        const fallbackCandidate = normalizedText.replace(PLACEHOLDER_REGEX, 'X');
        candidates.push(fallbackCandidate);
        
        if (!hasPlaceholders || examples.length === 0) {
            return candidates;
        }
        
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
     * Resolve And/But keyword by looking at previous steps.
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
        
        for (let i = lineNumber - 1; i >= 0; i--) {
            const line = document.lineAt(i).text;
            const match = line.match(/^\s*(Given|When|Then)\s+/i);
            if (match) {
                const prevKeyword = match[1].toLowerCase();
                if (prevKeyword === 'given') return 'Given';
                if (prevKeyword === 'when') return 'When';
                if (prevKeyword === 'then') return 'Then';
            }
            if (/^\s*(Scenario|Feature|Background):/i.test(line)) {
                break;
            }
        }
        
        return 'Given';
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
