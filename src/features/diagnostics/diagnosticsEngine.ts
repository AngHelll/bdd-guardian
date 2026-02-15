/**
 * Diagnostics Engine - Analyzes feature files and reports unbound/ambiguous steps.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword, FeatureStep, MatchStatus } from '../../core/domain';
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
        const resolve = createResolver(deps);
        
        const diagnostics: vscode.Diagnostic[] = [];
        let unbound = 0;
        let ambiguous = 0;
        let bound = 0;
        
        const lines = document.getText().split('\n');
        let currentTags: string[] = [];
        let prevResolvedKeyword: ResolvedKeyword = 'Given';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Track tags
            const tagMatch = line.match(/^\s*(@\S+(?:\s+@\S+)*)\s*$/);
            if (tagMatch) {
                currentTags = tagMatch[1].split(/\s+/).filter(t => t.startsWith('@'));
                continue;
            }
            
            // Reset tags on scenario/feature line
            if (/^\s*(Feature|Scenario|Scenario Outline|Background):/i.test(line)) {
                currentTags = [];
                prevResolvedKeyword = 'Given';
                continue;
            }
            
            // Check for step
            const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i);
            if (!stepMatch) continue;
            
            // Apply tag filter
            if (config.tagFilter.length > 0) {
                if (!shouldShowStep(currentTags)) {
                    continue;
                }
            }
            
            const keyword = stepMatch[1];
            const text = stepMatch[2].trim();
            const resolvedKeyword = this.resolveKeyword(keyword, prevResolvedKeyword);
            prevResolvedKeyword = resolvedKeyword;
            
            const step = {
                keywordOriginal: keyword as any,
                keywordResolved: resolvedKeyword,
                rawText: text,
                normalizedText: text.replace(/\s+/g, ' ').trim(),
                fullText: line.trim(),
                tagsEffective: currentTags,
                uri: document.uri,
                range: new vscode.Range(i, 0, i, line.length),
                lineNumber: i,
                isOutline: false,
                candidateTexts: [text],
            };
            
            const result = resolve(step as any);
            
            if (result.status === 'unbound') {
                unbound++;
                diagnostics.push(new vscode.Diagnostic(
                    step.range,
                    t('diagnosticUnboundStep', text),
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
    
    /**
     * Resolve And/But to actual keyword.
     */
    private resolveKeyword(keyword: string, previous: ResolvedKeyword): ResolvedKeyword {
        const lower = keyword.toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
        return previous;
    }
    
    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
