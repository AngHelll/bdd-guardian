/**
 * Binding CodeLens Provider
 * Shows reference counts above step bindings in C#/TypeScript files
 * 
 * Displays clickable "→ N scenarios" that navigates to all usages
 * This is a Quick UX Win that helps developers understand binding usage
 */

import * as vscode from 'vscode';
import { WorkspaceIndex } from '../core/index/workspaceIndex';
import { StepMatcher } from '../matcher';
import { FeatureStep, MatchResult, StepBinding, getConfig } from '../types';

/**
 * CodeLens provider for binding files (C#, TypeScript)
 * Shows how many scenarios use each binding
 */
export class BindingCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    constructor(
        private workspaceIndex: WorkspaceIndex,
        private stepMatcher: StepMatcher
    ) {}

    /**
     * Refresh CodeLens when index changes
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide CodeLens for binding files
     */
    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const config = getConfig();
        
        if (!config.enableCodeLens) {
            return [];
        }

        // Only process binding files (C# and TypeScript)
        const lang = document.languageId;
        if (lang !== 'csharp' && lang !== 'typescript' && lang !== 'javascript') {
            return [];
        }

        // Get bindings from this file
        const bindingDoc = this.workspaceIndex.getBindingFileByUri(document.uri);
        if (!bindingDoc || bindingDoc.bindings.length === 0) {
            return [];
        }

        // Calculate references for each binding
        const codeLenses: vscode.CodeLens[] = [];
        const allSteps = this.getAllStepsFromIndex();

        for (const binding of bindingDoc.bindings) {
            const usages = this.findBindingUsages(binding, allSteps);
            const lens = this.createReferenceLens(binding, usages);
            codeLenses.push(lens);
        }

        return codeLenses;
    }

    /**
     * Resolve CodeLens (already resolved in provide)
     */
    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        _token: vscode.CancellationToken
    ): vscode.CodeLens {
        return codeLens;
    }

    /**
     * Get all steps from all indexed features
     */
    private getAllStepsFromIndex(): FeatureStep[] {
        const allSteps: FeatureStep[] = [];
        const data = this.workspaceIndex.getData();
        
        for (const feature of data.features.values()) {
            // Convert domain FeatureStep to types FeatureStep
            for (const step of feature.allSteps) {
                allSteps.push({
                    keywordOriginal: step.keywordOriginal,
                    keywordResolved: step.keywordResolved,
                    stepText: step.rawText,
                    fullText: step.fullText,
                    tagsInScope: [...step.tagsEffective],
                    uri: step.uri,
                    range: step.range,
                    lineNumber: step.lineNumber,
                    scenarioName: step.scenarioName,
                });
            }
        }
        
        return allSteps;
    }

    /**
     * Find all steps that use a specific binding
     */
    private findBindingUsages(binding: StepBinding, allSteps: FeatureStep[]): FeatureStep[] {
        const usages: FeatureStep[] = [];
        
        for (const step of allSteps) {
            // Only match steps with the same keyword
            if (step.keywordResolved !== binding.keyword) {
                continue;
            }

            // Check if this binding matches the step
            const matchResult = this.stepMatcher.matchStep(step);
            
            if (matchResult.status === 'bound' && matchResult.bestMatch) {
                // Check if this specific binding is the match
                if (this.isSameBinding(matchResult.bestMatch.binding, binding)) {
                    usages.push(step);
                }
            } else if (matchResult.status === 'ambiguous') {
                // Check if this binding is among the matches
                const isMatch = matchResult.matches.some(m => 
                    this.isSameBinding(m.binding, binding)
                );
                if (isMatch) {
                    usages.push(step);
                }
            }
        }

        return usages;
    }

    /**
     * Check if two bindings are the same
     */
    private isSameBinding(a: StepBinding, b: StepBinding): boolean {
        return a.uri.toString() === b.uri.toString() && 
               a.lineNumber === b.lineNumber;
    }

    /**
     * Create a CodeLens showing reference count
     */
    private createReferenceLens(binding: StepBinding, usages: FeatureStep[]): vscode.CodeLens {
        const count = usages.length;
        const uniqueScenarios = this.getUniqueScenarios(usages);
        
        let title: string;
        let tooltip: string;
        let command: vscode.Command | undefined;

        if (count === 0) {
            title = '○ No usages';
            tooltip = 'This binding is not used by any step';
            command = undefined;
        } else if (count === 1) {
            const scenario = usages[0].scenarioName ?? 'Unknown scenario';
            title = `→ 1 usage (${scenario})`;
            tooltip = `Used in: ${scenario}`;
            command = {
                title,
                command: 'reqnrollNavigator.goToStepUsage',
                arguments: [usages[0]],
                tooltip,
            };
        } else {
            title = `→ ${count} usages (${uniqueScenarios} scenarios)`;
            tooltip = `Click to see all ${count} usages in ${uniqueScenarios} scenarios`;
            command = {
                title,
                command: 'reqnrollNavigator.showBindingUsages',
                arguments: [binding, usages],
                tooltip,
            };
        }

        const range = new vscode.Range(binding.lineNumber, 0, binding.lineNumber, 0);

        return new vscode.CodeLens(range, command ?? { title, command: '' });
    }

    /**
     * Count unique scenarios from usages
     */
    private getUniqueScenarios(usages: FeatureStep[]): number {
        const scenarios = new Set<string>();
        
        for (const usage of usages) {
            const key = `${usage.uri.toString()}:${usage.scenarioName ?? 'unknown'}`;
            scenarios.add(key);
        }
        
        return scenarios.size;
    }
}
