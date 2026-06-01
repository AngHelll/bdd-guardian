/**
 * CodeLens Provider - Shows binding information above each step.
 * Uses core gherkinParser for Scenario Outline and Scenario+Examples candidates.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, applyMatchingSettings, ResolveResult, ResolverDependencies } from '../../core/matching';
import { parseFeatureDocument } from '../../core/parsing/gherkinParser';
import { getStepAtPosition } from '../../core/references/stepContext';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword, FeatureStep } from '../../core/domain';
import { t } from '../../i18n';
import { FEATURE_DOCUMENT_SELECTORS } from './documentSelectors';

interface StepCodeLens extends vscode.CodeLens {
    stepText: string;
    keyword: string;
    lineIndex: number;
    documentUri: vscode.Uri;
    indexedStep?: FeatureStep;
    result?: ResolveResult;
}

export class CodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    
    constructor(private indexManager: IndexManager) {}
    
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

        const parsed = parseFeatureDocument(document);
        const stepByLine = new Map(
            parsed?.allSteps.map((s) => [s.lineNumber, s]) ?? []
        );
        
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split('\n');
        let currentTags: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            const tagMatch = line.match(/^\s*(@\S+(?:\s+@\S+)*)\s*$/);
            if (tagMatch) {
                currentTags = tagMatch[1].split(/\s+/).filter(t => t.startsWith('@'));
                continue;
            }

            if (/^\s*(Scenario|Scenario Outline|Feature|Background):/i.test(line.trim())) {
                currentTags = [];
                continue;
            }
            
            const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i);
            if (!stepMatch) {
                continue;
            }

            const indexedStep = stepByLine.get(i);
            const effectiveTags = indexedStep?.tagsEffective ?? currentTags;

            if (config.tagFilter.length > 0 && !shouldShowStep(effectiveTags)) {
                continue;
            }
                
            const keyword = stepMatch[1];
            const text = stepMatch[2].trim();
            const range = new vscode.Range(i, 0, i, line.length);
                
            const lens: StepCodeLens = Object.assign(
                new vscode.CodeLens(range),
                { 
                    stepText: text, 
                    keyword,
                    lineIndex: i,
                    documentUri: document.uri,
                    indexedStep,
                }
            );
                
            codeLenses.push(lens);
        }
        
        return codeLenses;
    }
    
    resolveCodeLens(
        codeLens: vscode.CodeLens,
        _token: vscode.CancellationToken
    ): vscode.CodeLens | Thenable<vscode.CodeLens> {
        const stepLens = codeLens as StepCodeLens;
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            codeLens.command = {
                title: `$(warning) ${t('codelensNoBindingsIndexed')}`,
                command: 'reqnroll-navigator.reindexWorkspace',
            };
            return codeLens;
        }
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));

        const openDoc = vscode.workspace.textDocuments.find(
            (d) => d.uri.toString() === stepLens.documentUri.toString()
        );
        const step =
            (openDoc ? getStepAtPosition(openDoc, codeLens.range.start) : undefined) ??
            stepLens.indexedStep ??
            this.fallbackStep(stepLens, codeLens);
        
        const result = resolve(step);
        stepLens.result = result;
        
        if (result.candidates.length === 0) {
            codeLens.command = {
                title: `$(error) ${t('codelensNoBindingFound')}`,
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        } else if (result.candidates.length === 1 || result.status === 'bound') {
            const candidate = result.candidates[0];
            const icon = result.status === 'ambiguous' ? '$(warning)' : '$(symbol-method)';
            codeLens.command = {
                title: `${icon} ${candidate.binding.className}.${candidate.binding.methodName} (${candidate.score})`,
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        } else {
            const best = result.candidates[0];
            codeLens.command = {
                title: `$(symbol-method) ${best.binding.methodName} ${t('codelensAmbiguousMore', String(result.candidates.length - 1))}`,
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        }
        
        return codeLens;
    }
    
    private fallbackStep(stepLens: StepCodeLens, codeLens: vscode.CodeLens): FeatureStep {
        return {
            keywordOriginal: stepLens.keyword as FeatureStep['keywordOriginal'],
            keywordResolved: this.normalizeKeyword(stepLens.keyword),
            rawText: stepLens.stepText,
            normalizedText: stepLens.stepText.replace(/\s+/g, ' ').trim(),
            fullText: `${stepLens.keyword} ${stepLens.stepText}`,
            tagsEffective: [],
            uri: stepLens.documentUri,
            range: codeLens.range,
            lineNumber: codeLens.range.start.line,
            isOutline: false,
            candidateTexts: [stepLens.stepText.replace(/\s+/g, ' ').trim()],
        };
    }

    private normalizeKeyword(keyword: string): ResolvedKeyword {
        const lower = keyword.toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
        return 'Given';
    }
}

export function createCodeLensProvider(indexManager: IndexManager): {
    provider: CodeLensProvider;
    disposable: vscode.Disposable;
} {
    const provider = new CodeLensProvider(indexManager);
    return {
        provider,
        disposable: vscode.languages.registerCodeLensProvider(
            FEATURE_DOCUMENT_SELECTORS,
            provider
        ),
    };
}
