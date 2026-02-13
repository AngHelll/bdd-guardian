/**
 * Hover Provider - Enhanced
 * Shows detailed binding information on hover for Gherkin steps
 * 
 * Features (v0.3.1):
 * - Binding status (Bound / Ambiguous / Unbound)
 * - Code preview of the binding method
 * - File location with click-to-navigate
 * - Parameter info for bound steps
 * 
 * Uses the same matcher as CodeLens/Definition for consistency.
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { StepMatcher } from '../matcher';
import { MatchResult, StepBinding } from '../types';

/** Maximum lines to show in code preview */
const MAX_PREVIEW_LINES = 8;

export class StepHoverProvider implements vscode.HoverProvider {
    constructor(
        private featureIndexer: FeatureIndexer,
        private stepMatcher: StepMatcher
    ) {}

    /**
     * Provide hover information for a step
     */
    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        // Get the step at the current position
        const step = this.featureIndexer.getStepAtPosition(document.uri, position);

        if (!step) {
            return undefined;
        }

        // Match the step to bindings
        const matchResult = this.stepMatcher.matchStep(step);

        // Build markdown content
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        markdown.supportHtml = true;

        // Header
        markdown.appendMarkdown('### 🔗 BDD Guardian\n\n');

        // Step info
        markdown.appendMarkdown(`**Step:** \`${step.keywordOriginal} ${step.stepText}\`\n\n`);

        switch (matchResult.status) {
            case 'bound':
                await this.appendBoundInfo(markdown, matchResult);
                break;
            case 'ambiguous':
                await this.appendAmbiguousInfo(markdown, matchResult);
                break;
            case 'unbound':
                this.appendUnboundInfo(markdown);
                break;
        }

        return new vscode.Hover(markdown, step.range);
    }

    /**
     * Append bound step information to markdown with code preview
     */
    private async appendBoundInfo(
        markdown: vscode.MarkdownString, 
        matchResult: { bestMatch?: MatchResult }
    ): Promise<void> {
        markdown.appendMarkdown('**Status:** ✅ Bound\n\n');

        if (matchResult.bestMatch) {
            const binding = matchResult.bestMatch.binding;
            markdown.appendMarkdown('---\n\n');
            
            // Binding info
            markdown.appendMarkdown(`**Binding:** \`${binding.className}.${binding.methodName}\`\n\n`);
            markdown.appendMarkdown(`**Pattern:** \`${this.escapeMarkdown(binding.patternRaw)}\`\n\n`);
            
            // File location (clickable)
            const relativePath = vscode.workspace.asRelativePath(binding.uri);
            const lineNum = binding.lineNumber + 1;
            markdown.appendMarkdown(`**File:** [${relativePath}:${lineNum}](${binding.uri}#L${lineNum})\n\n`);
            
            // Match score
            markdown.appendMarkdown(`**Score:** ${matchResult.bestMatch.score}\n\n`);
            
            // Code preview
            const preview = await this.getCodePreview(binding);
            if (preview) {
                markdown.appendMarkdown('**Preview:**\n');
                markdown.appendCodeblock(preview, this.getLanguageId(binding.uri));
            }
        }
    }

    /**
     * Append ambiguous step information to markdown
     */
    private async appendAmbiguousInfo(
        markdown: vscode.MarkdownString, 
        matchResult: { matches: MatchResult[] }
    ): Promise<void> {
        markdown.appendMarkdown('**Status:** ⚠️ Ambiguous\n\n');
        markdown.appendMarkdown(`Found **${matchResult.matches.length}** matching bindings:\n\n`);
        markdown.appendMarkdown('---\n\n');

        // Show top 3 candidates with previews
        const topCandidates = matchResult.matches.slice(0, 3);

        for (let i = 0; i < topCandidates.length; i++) {
            const match = topCandidates[i];
            const binding = match.binding;
            const relativePath = vscode.workspace.asRelativePath(binding.uri);
            const lineNum = binding.lineNumber + 1;

            markdown.appendMarkdown(`**${i + 1}.** \`${binding.className}.${binding.methodName}\`\n\n`);
            markdown.appendMarkdown(`   Pattern: \`${this.escapeMarkdown(binding.patternRaw)}\`\n\n`);
            markdown.appendMarkdown(`   Score: ${match.score} | [${relativePath}:${lineNum}](${binding.uri}#L${lineNum})\n\n`);
        }

        if (matchResult.matches.length > 3) {
            markdown.appendMarkdown(`*...and ${matchResult.matches.length - 3} more*\n`);
        }
    }

    /**
     * Append unbound step information to markdown
     */
    private appendUnboundInfo(markdown: vscode.MarkdownString): void {
        markdown.appendMarkdown('**Status:** ❌ Unbound\n\n');
        markdown.appendMarkdown('---\n\n');
        markdown.appendMarkdown('No binding found for this step.\n\n');
        markdown.appendMarkdown('💡 *Create a step definition with a matching pattern.*\n');
    }

    /**
     * Get code preview for a binding
     */
    private async getCodePreview(binding: StepBinding): Promise<string | null> {
        try {
            const document = await vscode.workspace.openTextDocument(binding.uri);
            const startLine = binding.lineNumber;
            const endLine = Math.min(startLine + MAX_PREVIEW_LINES, document.lineCount);
            
            const lines: string[] = [];
            for (let i = startLine; i < endLine; i++) {
                const line = document.lineAt(i).text;
                lines.push(line);
                
                // Stop at closing brace of method
                if (line.trim() === '}' && i > startLine + 1) {
                    break;
                }
            }
            
            // Trim trailing empty lines
            while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                lines.pop();
            }
            
            // Add ellipsis if truncated
            if (lines.length === MAX_PREVIEW_LINES) {
                lines.push('    // ...');
            }
            
            return lines.join('\n');
        } catch {
            return null;
        }
    }

    /**
     * Get language ID from file URI
     */
    private getLanguageId(uri: vscode.Uri): string {
        const path = uri.fsPath.toLowerCase();
        if (path.endsWith('.cs')) return 'csharp';
        if (path.endsWith('.ts')) return 'typescript';
        if (path.endsWith('.js')) return 'javascript';
        return 'text';
    }

    /**
     * Escape special markdown characters in pattern
     */
    private escapeMarkdown(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');
    }
}
