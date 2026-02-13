/**
 * Coach Diagnostics Provider
 * Displays Coach findings as VS Code diagnostics.
 */

import * as vscode from 'vscode';
import { CoachFinding, toVSCodeSeverity } from './rules/types';
import { parseGherkinDocument } from './gherkinParser';
import { RuleEngine, RuleEngineResult } from './ruleEngine';
import { getCoachConfig } from './config';

export class CoachDiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];
    private ruleEngine: RuleEngine;
    private enabled: boolean = false;
    private debounceTimer: NodeJS.Timeout | undefined;
    
    // Diagnostic source name
    static readonly SOURCE = 'BDD Coach';
    
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(CoachDiagnosticsProvider.SOURCE);
        this.ruleEngine = new RuleEngine(getCoachConfig());
        
        // Read enabled state from config
        this.updateEnabledState();
        
        // Subscribe to config changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('bddGuardian.coach')) {
                    this.updateEnabledState();
                    this.refreshRuleEngine();
                    // Re-analyze all open .feature files
                    this.analyzeAllOpenFeatureFiles();
                }
            })
        );
        
        // Subscribe to document changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (this.enabled && e.document.languageId === 'feature') {
                    this.analyzeDocumentDebounced(e.document);
                }
            })
        );
        
        // Subscribe to document open
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(doc => {
                if (this.enabled && doc.languageId === 'feature') {
                    this.analyzeDocument(doc);
                }
            })
        );
        
        // Subscribe to document close
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                this.diagnosticCollection.delete(doc.uri);
            })
        );
        
        // Analyze currently open feature files
        if (this.enabled) {
            this.analyzeAllOpenFeatureFiles();
        }
    }
    
    private updateEnabledState(): void {
        const config = vscode.workspace.getConfiguration('bddGuardian.coach');
        this.enabled = config.get<boolean>('enabled', false);
        
        if (!this.enabled) {
            this.diagnosticCollection.clear();
        }
    }
    
    private refreshRuleEngine(): void {
        this.ruleEngine = new RuleEngine(getCoachConfig());
    }
    
    private analyzeAllOpenFeatureFiles(): void {
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.languageId === 'feature') {
                this.analyzeDocument(doc);
            }
        }
    }
    
    private analyzeDocumentDebounced(document: vscode.TextDocument): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.analyzeDocument(document);
        }, 300);
    }
    
    /**
     * Analyze a document and update diagnostics.
     */
    analyzeDocument(document: vscode.TextDocument): RuleEngineResult | null {
        if (!this.enabled) {
            return null;
        }
        
        try {
            const model = parseGherkinDocument(document);
            const result = this.ruleEngine.run(model);
            
            const diagnostics = result.findings.map(finding => this.findingToDiagnostic(finding));
            this.diagnosticCollection.set(document.uri, diagnostics);
            
            return result;
        } catch (error) {
            console.error('[Coach] Error analyzing document:', error);
            return null;
        }
    }
    
    private findingToDiagnostic(finding: CoachFinding): vscode.Diagnostic {
        const range = new vscode.Range(
            finding.line,
            finding.column,
            finding.endLine ?? finding.line,
            finding.endColumn ?? finding.column + 1
        );
        
        const diagnostic = new vscode.Diagnostic(
            range,
            finding.message,
            toVSCodeSeverity(finding.severity)
        );
        
        diagnostic.source = CoachDiagnosticsProvider.SOURCE;
        diagnostic.code = finding.ruleId;
        
        return diagnostic;
    }
    
    /**
     * Check if Coach is enabled.
     */
    isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Enable or disable Coach.
     */
    async setEnabled(enabled: boolean): Promise<void> {
        const config = vscode.workspace.getConfiguration('bddGuardian.coach');
        await config.update('enabled', enabled, vscode.ConfigurationTarget.Global);
    }
    
    /**
     * Get diagnostics for a document.
     */
    getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
        return this.diagnosticCollection.get(uri) ?? [];
    }
    
    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.diagnosticCollection.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
