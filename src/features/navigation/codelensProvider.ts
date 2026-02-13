/**
 * CodeLens Provider - Shows binding information above each step.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolveResult, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword } from '../../core/domain';

interface StepCodeLens extends vscode.CodeLens {
    stepText: string;
    keyword: string;
    result?: ResolveResult;
}

export class CodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    
    constructor(private indexManager: IndexManager) {}
    
    /**
     * Refresh CodeLenses (call when index changes).
     */
    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
    
    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (!document.fileName.endsWith('.feature')) {
            return [];
        }
        
        const config = getConfig();
        if (!config.enableCodeLens) {
            return [];
        }
        
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split('\n');
        
        // Track current tags for filtering
        let currentTags: string[] = [];
        
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
                // Tags before this line apply to this block
                currentTags = [];
                continue;
            }
            
            // Check for step
            const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i);
            if (stepMatch) {
                // Apply tag filtering if enabled
                if (config.tagFilter.length > 0) {
                    if (!shouldShowStep(currentTags)) {
                        continue;
                    }
                }
                
                const keyword = stepMatch[1];
                const text = stepMatch[2].trim();
                const range = new vscode.Range(i, 0, i, line.length);
                
                const lens: StepCodeLens = Object.assign(
                    new vscode.CodeLens(range),
                    { stepText: text, keyword }
                );
                
                codeLenses.push(lens);
            }
        }
        
        return codeLenses;
    }
    
    resolveCodeLens(
        codeLens: vscode.CodeLens,
        _token: vscode.CancellationToken
    ): vscode.CodeLens | Thenable<vscode.CodeLens> {
        const stepLens = codeLens as StepCodeLens;
        const index = this.indexManager.getIndex();
        
        // Get bindings for all keyword types (for And/But compatibility)
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            codeLens.command = {
                title: '$(warning) No bindings indexed',
                command: 'reqnroll-navigator.showStatistics',
            };
            return codeLens;
        }
        
        // Create resolver
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);
        
        // Build minimal step for resolution
        const resolvedKeyword = this.normalizeKeyword(stepLens.keyword);
        const step = {
            keywordOriginal: stepLens.keyword as any,
            keywordResolved: resolvedKeyword,
            rawText: stepLens.stepText,
            normalizedText: stepLens.stepText.replace(/\s+/g, ' ').trim(),
            fullText: `${stepLens.keyword} ${stepLens.stepText}`,
            tagsEffective: [],
            uri: vscode.Uri.file(''),
            range: codeLens.range,
            lineNumber: codeLens.range.start.line,
            isOutline: false,
            candidateTexts: [stepLens.stepText],
        };
        
        const result = resolve(step as any);
        stepLens.result = result;
        
        if (result.candidates.length === 0) {
            codeLens.command = {
                title: '$(error) No binding found',
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        } else if (result.candidates.length === 1) {
            const candidate = result.candidates[0];
            codeLens.command = {
                title: `$(symbol-method) ${candidate.binding.methodName} (${candidate.score})`,
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        } else {
            const best = result.candidates[0];
            codeLens.command = {
                title: `$(symbol-method) ${best.binding.methodName} +${result.candidates.length - 1} more`,
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        }
        
        return codeLens;
    }
    
    private normalizeKeyword(keyword: string): ResolvedKeyword {
        const upper = keyword.toLowerCase();
        if (upper === 'given') return 'Given';
        if (upper === 'when') return 'When';
        if (upper === 'then') return 'Then';
        return 'Given';
    }
    
    dispose(): void {
        this._onDidChangeCodeLenses.dispose();
    }
}

/**
 * Create and register the CodeLens provider.
 */
export function createCodeLensProvider(
    indexManager: IndexManager
): { provider: CodeLensProvider; disposable: vscode.Disposable } {
    const provider = new CodeLensProvider(indexManager);
    
    // Register for multiple selectors to ensure .feature files are handled
    const selectors: vscode.DocumentSelector = [
        { language: 'gherkin', scheme: 'file' },
        { language: 'feature', scheme: 'file' },
        { language: 'cucumber', scheme: 'file' },
        { pattern: '**/*.feature', scheme: 'file' },
    ];
    
    const disposable = vscode.languages.registerCodeLensProvider(selectors, provider);
    
    return { provider, disposable };
}
