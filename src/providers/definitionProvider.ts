/**
 * Definition Provider
 * Provides Go to Definition for Gherkin steps
 * 
 * IMPORTANT: Navigation ALWAYS works regardless of tag filters.
 * Tag filtering only affects CodeLens and Diagnostics visibility.
 * 
 * NOTE: This provider returns vscode.Location which VS Code handles natively.
 * For QuickPick selections, we use navigateToLocation helper to ensure
 * proper back/forward history tracking.
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { StepMatcher } from '../matcher';
import { MatchResult } from '../types';
import { navigateToLocation } from '../utils';

export class StepDefinitionProvider implements vscode.DefinitionProvider {
    constructor(
        private featureIndexer: FeatureIndexer,
        private stepMatcher: StepMatcher
    ) {}

    /**
     * Provide definition for a step at the given position.
     * NOTE: This method does NOT filter by tags - navigation always works.
     */
    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        // Get the step at the current position
        // NOTE: We do NOT filter by tags here - navigation always works
        const step = this.featureIndexer.getStepAtPosition(document.uri, position);
        
        if (!step) {
            return undefined;
        }

        // Match the step to bindings (no tag filtering for navigation)
        const matchResult = this.stepMatcher.matchStep(step);

        if (matchResult.status === 'unbound') {
            // Show message for unbound step
            vscode.window.showWarningMessage(`No binding found for step: "${step.stepText}"`);
            return undefined;
        }

        if (matchResult.status === 'ambiguous') {
            // Show quick pick for ambiguous matches
            const items = matchResult.matches.map((match: MatchResult) => ({
                label: `${match.binding.className}.${match.binding.methodName}`,
                description: `[${match.binding.keyword}] ${match.binding.patternRaw}`,
                detail: `${vscode.workspace.asRelativePath(match.binding.uri)}:${match.binding.lineNumber + 1}`,
                binding: match.binding,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Multiple bindings found. Select one to navigate:',
                matchOnDescription: true,
                matchOnDetail: true,
            });

            if (selected) {
                // Use navigateToLocation for proper back/forward history
                // when navigating from QuickPick selection
                await navigateToLocation(selected.binding.uri, selected.binding.range);
            }
            // Return undefined since we handled navigation manually
            return undefined;
        }

        // Single match - return Location for VS Code to handle natively
        // VS Code's built-in handling preserves navigation history correctly
        if (matchResult.bestMatch) {
            return new vscode.Location(
                matchResult.bestMatch.binding.uri,
                matchResult.bestMatch.binding.range
            );
        }

        return undefined;
    }
}
