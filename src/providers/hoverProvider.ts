/**
 * Hover Provider
 * Shows detailed binding information on hover for Gherkin steps
 * 
 * Displays:
 * - Binding status (Bound / Ambiguous / Unbound)
 * - For bound: Class.Method and pattern
 * - For ambiguous: Top 3 candidate bindings
 * - For unbound: "No binding found" message
 * 
 * Uses the same matcher as CodeLens/Definition for consistency.
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { StepMatcher } from '../matcher';
import { MatchResult } from '../types';

export class StepHoverProvider implements vscode.HoverProvider {
    constructor(
        private featureIndexer: FeatureIndexer,
        private stepMatcher: StepMatcher
    ) {}

    /**
     * Provide hover information for a step
     */
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | undefined {
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
        markdown.appendMarkdown('### 🔗 Reqnroll Navigator\n\n');

        // Step info
        markdown.appendMarkdown(`**Step:** \`${step.keywordOriginal} ${step.stepText}\`\n\n`);

        switch (matchResult.status) {
            case 'bound':
                this.appendBoundInfo(markdown, matchResult);
                break;
            case 'ambiguous':
                this.appendAmbiguousInfo(markdown, matchResult);
                break;
            case 'unbound':
                this.appendUnboundInfo(markdown);
                break;
        }

        return new vscode.Hover(markdown, step.range);
    }

    /**
     * Append bound step information to markdown
     */
    private appendBoundInfo(markdown: vscode.MarkdownString, matchResult: { bestMatch?: MatchResult }): void {
        markdown.appendMarkdown('**Status:** ✅ Bound\n\n');

        if (matchResult.bestMatch) {
            const binding = matchResult.bestMatch.binding;
            markdown.appendMarkdown('---\n\n');
            markdown.appendMarkdown(`**Binding:** \`${binding.className}.${binding.methodName}\`\n\n`);
            markdown.appendMarkdown(`**Pattern:** \`${this.escapeMarkdown(binding.patternRaw)}\`\n\n`);
            markdown.appendMarkdown(`**File:** ${vscode.workspace.asRelativePath(binding.uri)}:${binding.lineNumber + 1}\n\n`);
            markdown.appendMarkdown(`**Score:** ${matchResult.bestMatch.score}\n`);
        }
    }

    /**
     * Append ambiguous step information to markdown
     */
    private appendAmbiguousInfo(markdown: vscode.MarkdownString, matchResult: { matches: MatchResult[] }): void {
        markdown.appendMarkdown('**Status:** ⚠️ Ambiguous\n\n');
        markdown.appendMarkdown(`Found **${matchResult.matches.length}** matching bindings:\n\n`);
        markdown.appendMarkdown('---\n\n');

        // Show top 3 candidates
        const topCandidates = matchResult.matches.slice(0, 3);
        
        for (let i = 0; i < topCandidates.length; i++) {
            const match = topCandidates[i];
            const binding = match.binding;
            
            markdown.appendMarkdown(`**${i + 1}.** \`${binding.className}.${binding.methodName}\`\n\n`);
            markdown.appendMarkdown(`   Pattern: \`${this.escapeMarkdown(binding.patternRaw)}\`\n\n`);
            markdown.appendMarkdown(`   Score: ${match.score} | ${vscode.workspace.asRelativePath(binding.uri)}:${binding.lineNumber + 1}\n\n`);
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
        markdown.appendMarkdown('*Create a step definition with a matching pattern.*\n');
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
