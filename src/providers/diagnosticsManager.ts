/**
 * Diagnostics Manager
 * Provides diagnostic warnings for unbound and ambiguous steps
 * 
 * IMPORTANT: Tag filtering affects ONLY Diagnostics visibility.
 * Navigation (Go to Definition) always works regardless of tags.
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { StepMatcher } from '../matcher';
import { getConfig, getTagFilterConfig, filterStepsByTags, MatchResult } from '../types';

export class DiagnosticsManager {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(
        private featureIndexer: FeatureIndexer,
        private stepMatcher: StepMatcher
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('reqnroll-navigator');
    }

    /**
     * Update diagnostics for a document
     */
    public updateDiagnostics(document: vscode.TextDocument): void {
        const config = getConfig();
        
        if (!config.enableDiagnostics) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        if (document.languageId !== 'gherkin' && !document.fileName.endsWith('.feature')) {
            return;
        }

        const feature = this.featureIndexer.getFeatureByUri(document.uri);
        
        if (!feature) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        // IMPORTANT: Apply tag filter for Diagnostics visibility
        // This does NOT affect navigation - only what diagnostics are shown
        const tagFilterConfig = getTagFilterConfig();
        const steps = filterStepsByTags(feature.allSteps, tagFilterConfig);
        
        const diagnostics: vscode.Diagnostic[] = [];

        for (const step of steps) {
            const matchResult = this.stepMatcher.matchStep(step);

            if (matchResult.status === 'unbound') {
                const diagnostic = new vscode.Diagnostic(
                    step.range,
                    `Unbound step: No binding found for "${step.stepText}"`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'Reqnroll Navigator';
                diagnostic.code = 'unbound-step';
                diagnostics.push(diagnostic);
            } else if (matchResult.status === 'ambiguous') {
                const bindingList = matchResult.matches
                    .slice(0, 3)
                    .map((m: MatchResult) => `${m.binding.className}.${m.binding.methodName}`)
                    .join(', ');
                
                const diagnostic = new vscode.Diagnostic(
                    step.range,
                    `Ambiguous step: ${matchResult.matches.length} bindings match (${bindingList}${matchResult.matches.length > 3 ? '...' : ''})`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'Reqnroll Navigator';
                diagnostic.code = 'ambiguous-step';
                diagnostics.push(diagnostic);
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    /**
     * Update diagnostics for all open feature documents
     */
    public updateAllDiagnostics(): void {
        for (const document of vscode.workspace.textDocuments) {
            if (document.languageId === 'gherkin' || document.fileName.endsWith('.feature')) {
                this.updateDiagnostics(document);
            }
        }
    }

    /**
     * Clear all diagnostics
     */
    public clearAll(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Dispose the diagnostic collection
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
