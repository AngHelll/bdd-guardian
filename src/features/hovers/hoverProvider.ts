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
import { createResolver, applyMatchingSettings, ResolverDependencies } from '../../core/matching';
import { ResolvedKeyword, Binding, MatchCandidate } from '../../core/domain';
import { 
    StepStatus, 
    getUIConfig, 
    getStatusEmoji, 
    getStatusLabel,
    formatBinding,
    sortCandidatesByScore 
} from '../../ui/stepStatus';
import { t } from '../../i18n';
import { getStepAtPosition } from '../../core/references/stepContext';

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
        
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            return this.createIndexingHover(position, line);
        }

        const step = getStepAtPosition(document, position);
        if (!step) {
            return null;
        }
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));
        
        const result = resolve(step);
        
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
        const statusLabel = status === StepStatus.Bound ? t('hoverBound') : status === StepStatus.Unbound ? t('hoverUnbound') : t('hoverAmbiguous');
        contents.appendMarkdown(`#### ${t('hoverTitle')}\n\n`);
        contents.appendMarkdown(`**${t('hoverStatus')}:** ${getStatusEmoji(status)} ${statusLabel}\n\n`);
        contents.appendMarkdown('---\n\n');
        
        // Build content based on status
        if (status === StepStatus.Unbound) {
            await this.buildUnboundContent(contents, step.rawText, step.keywordResolved);
        } else if (status === StepStatus.Ambiguous) {
            await this.buildAmbiguousContent(contents, [...result.candidates], step.rawText);
        } else {
            await this.buildBoundContent(contents, result.best!, step.rawText);
        }
        
        return new vscode.Hover(contents, new vscode.Range(position.line, 0, position.line, line.length));
    }
    
    /**
     * Build content for unbound steps.
     */
    private async buildUnboundContent(
        contents: vscode.MarkdownString,
        stepText: string,
        keyword: ResolvedKeyword = 'When'
    ): Promise<void> {
        contents.appendMarkdown(t('hoverNoBindingFound') + '\n\n');
        
        const suggestedPattern = this.suggestBindingPattern(stepText);
        contents.appendMarkdown(`**${t('hoverSuggestedBinding')}**\n`);
        contents.appendMarkdown('```csharp\n');
        contents.appendMarkdown(`[${keyword}(@"${suggestedPattern}")]\n`);
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
        
        contents.appendMarkdown(`**${t('hoverBindingsMatch', String(candidates.length))}**\n\n`);
        
        for (let i = 0; i < topCandidates.length; i++) {
            const candidate = topCandidates[i];
            const binding = candidate.binding;
            const relativePath = vscode.workspace.asRelativePath(binding.uri);
            const isBest = i === 0;
            
            if (isBest) {
                contents.appendMarkdown(`🏆 **${t('hoverBestMatch')}**\n`);
            }
            
            contents.appendMarkdown(`- \`${binding.className}.${binding.methodName}\`\n`);
            contents.appendMarkdown(`  - File: \`${relativePath}:${binding.lineNumber + 1}\`\n`);
            contents.appendMarkdown(`  - Pattern: \`${this.truncate(binding.patternRaw, 40)}\`\n\n`);
        }
        
        if (candidates.length > 3) {
            contents.appendMarkdown(`_...and ${candidates.length - 3} more_\n\n`);
        }
        
        // Command link to show all
        contents.appendMarkdown(`[${t('hoverShowAllMatches')}](command:reqnrollNavigator.showAmbiguousMatches)`);
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
        contents.appendMarkdown(`**${t('hoverBinding')}:** \`${binding.className}.${binding.methodName}\`\n\n`);
        contents.appendMarkdown(`**${t('hoverPattern')}:** \`${binding.patternRaw}\`\n\n`);
        contents.appendMarkdown(`**${t('hoverFile')}:** [${relativePath}:${binding.lineNumber + 1}](${binding.uri.toString()}#L${binding.lineNumber + 1})\n\n`);
        
        // Captured parameters
        const captures = this.extractCaptures(stepText, binding);
        if (captures.length > 0) {
            contents.appendMarkdown(`**${t('hoverCaptured')}:**\n`);
            captures.forEach((cap, idx) => {
                contents.appendMarkdown(`- \`$${idx + 1}\` = \`${cap}\`\n`);
            });
            contents.appendMarkdown('\n');
        }
        
        // Code preview: short snippet so the hover fits without scroll; user can open file for full method
        const codePreview = await this.getCodePreview(binding);
        if (codePreview) {
            contents.appendMarkdown(`**${t('hoverPreview')}:**\n`);
            contents.appendMarkdown('```csharp\n');
            contents.appendMarkdown(codePreview);
            contents.appendMarkdown('\n```\n');
            contents.appendMarkdown('_' + t('hoverClickFileLink') + '_\n');
        }
    }
    
    /**
     * Create hover when indexing is in progress.
     */
    private createIndexingHover(position: vscode.Position, line: string): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.isTrusted = true;
        contents.appendMarkdown(`#### ${t('hoverTitle')}\n\n`);
        contents.appendMarkdown(`**${t('hoverStatus')}:** ${getStatusEmoji(StepStatus.Indexing)} ${getStatusLabel(StepStatus.Indexing)}\n\n`);
        contents.appendMarkdown('---\n\n');
        contents.appendMarkdown(t('hoverIndexing') + '\n\n');
        contents.appendMarkdown(`[${t('hoverReindexNow')}](command:reqnrollNavigator.reindex)`);
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
    
    /** Max lines in hover code preview so the hover stays scrollable / fits on screen */
    private static readonly MAX_PREVIEW_LINES = 5;

    /**
     * Get code preview for a binding method (cached).
     * Kept short so the hover popup fits without requiring scroll inside the preview.
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
            const maxLines = HoverProvider.MAX_PREVIEW_LINES;
            const endLine = Math.min(startLine + maxLines + 2, doc.lineCount - 1);
            
            const lines: string[] = [];
            let braceCount = 0;
            let foundStart = false;
            
            for (let i = startLine; i <= endLine && lines.length < maxLines; i++) {
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
                const code = lines.join('\n') + '\n// …';
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
        const pattern = stepText
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
