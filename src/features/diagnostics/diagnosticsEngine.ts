/**
 * Diagnostics Engine - Analyzes feature files and reports unbound/ambiguous steps.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, applyMatchingSettings, ResolverDependencies } from '../../core/matching';
import { parseFeatureDocument } from '../../core/parsing/gherkinParser';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword } from '../../core/domain';
import { t } from '../../i18n';

export interface DiagnosticsResult {
    readonly uri: vscode.Uri;
    readonly diagnostics: vscode.Diagnostic[];
    readonly unbound: number;
    readonly ambiguous: number;
    readonly bound: number;
}

export class DiagnosticsEngine {
    private diagnosticCollection: vscode.DiagnosticCollection;
    
    constructor(
        private indexManager: IndexManager,
        collectionName: string = 'reqnroll-navigator'
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(collectionName);
    }
    
    /**
     * Analyze a single feature file and update diagnostics.
     */
    public analyzeFile(document: vscode.TextDocument): DiagnosticsResult {
        const config = getConfig();
        
        if (!config.enableDiagnostics || !document.fileName.endsWith('.feature')) {
            this.diagnosticCollection.delete(document.uri);
            return {
                uri: document.uri,
                diagnostics: [],
                unbound: 0,
                ambiguous: 0,
                bound: 0,
            };
        }
        
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            return {
                uri: document.uri,
                diagnostics: [],
                unbound: 0,
                ambiguous: 0,
                bound: 0,
            };
        }
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));
        
        const parsed = parseFeatureDocument(document);
        const steps = parsed?.allSteps ?? [];

        const diagnostics: vscode.Diagnostic[] = [];
        let unbound = 0;
        let ambiguous = 0;
        let bound = 0;
        
        for (const step of steps) {
            if (config.tagFilter.length > 0 && !shouldShowStep(step.tagsEffective)) {
                continue;
            }

            const result = resolve(step);
            
            if (result.status === 'unbound') {
                unbound++;
                diagnostics.push(new vscode.Diagnostic(
                    step.range,
                    t('diagnosticUnboundStep', step.rawText),
                    vscode.DiagnosticSeverity.Warning
                ));
            } else if (result.status === 'ambiguous') {
                ambiguous++;
                const names = result.candidates.slice(0, 3).map(c => c.binding.methodName).join(', ');
                const moreSuffix = result.candidates.length > 3 ? t('diagnosticAmbiguousStepMore', String(result.candidates.length - 3)) : '';
                diagnostics.push(new vscode.Diagnostic(
                    step.range,
                    t('diagnosticAmbiguousStep', names) + moreSuffix,
                    vscode.DiagnosticSeverity.Information
                ));
            } else {
                bound++;
            }
        }
        
        this.diagnosticCollection.set(document.uri, diagnostics);
        
        return { uri: document.uri, diagnostics, unbound, ambiguous, bound };
    }
    
    /**
     * Clear diagnostics for a file.
     */
    public clearFile(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
    }
    
    /**
     * Clear all diagnostics.
     */
    public clearAll(): void {
        this.diagnosticCollection.clear();
    }
    
    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
