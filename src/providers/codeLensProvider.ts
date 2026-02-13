/**
 * CodeLens Provider
 * Provides CodeLens above Gherkin steps showing binding status
 * 
 * IMPORTANT: Tag filtering affects ONLY CodeLens visibility.
 * Navigation (Go to Definition) always works regardless of tags.
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { StepMatcher } from '../matcher';
import { getConfig, getTagFilterConfig, filterStepsByTags, FeatureStep, MatchResult } from '../types';

export class StepCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        private featureIndexer: FeatureIndexer,
        private stepMatcher: StepMatcher
    ) {}

    /**
     * Refresh CodeLens
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const config = getConfig();
        
        if (!config.enableCodeLens) {
            return [];
        }

        // Get feature from index
        const feature = this.featureIndexer.getFeatureByUri(document.uri);
        
        if (!feature) {
            return [];
        }

        // IMPORTANT: Apply tag filter for CodeLens visibility
        // This does NOT affect navigation - only what CodeLens are shown
        const tagFilterConfig = getTagFilterConfig();
        const steps = filterStepsByTags(feature.allSteps, tagFilterConfig);
        
        const codeLenses: vscode.CodeLens[] = [];

        for (const step of steps) {
            const matchResult = this.stepMatcher.matchStep(step);
            const lens = this.createCodeLens(step, matchResult.status, matchResult.matches);
            
            if (lens) {
                codeLenses.push(lens);
            }
        }

        return codeLenses;
    }

    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        _token: vscode.CancellationToken
    ): vscode.CodeLens {
        // CodeLens is already resolved in provideCodeLenses
        return codeLens;
    }

    private createCodeLens(
        step: FeatureStep,
        status: 'bound' | 'unbound' | 'ambiguous',
        matches: MatchResult[]
    ): vscode.CodeLens | null {
        let title: string;
        let command: string;
        let args: unknown[];
        let tooltip: string;

        switch (status) {
            case 'bound':
                const binding = matches[0]?.binding;
                title = `✓ ${binding?.className}.${binding?.methodName}`;
                command = 'reqnrollNavigator.goToBinding';
                args = [step];
                tooltip = `Go to binding: [${binding?.keyword}] ${binding?.patternRaw}`;
                break;

            case 'unbound':
                title = '⚠ Unbound step';
                command = 'reqnrollNavigator.showUnboundWarning';
                args = [step.stepText];
                tooltip = 'No binding found for this step';
                break;

            case 'ambiguous':
                title = `⚡ ${matches.length} bindings (ambiguous)`;
                command = 'reqnrollNavigator.showAmbiguousBindings';
                args = [step, matches];
                tooltip = 'Multiple bindings match this step';
                break;

            default:
                return null;
        }

        return new vscode.CodeLens(step.range, {
            title,
            command,
            arguments: args,
            tooltip,
        });
    }
}
