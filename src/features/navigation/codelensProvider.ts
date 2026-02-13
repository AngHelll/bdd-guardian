/**
 * CodeLens Provider - Shows binding information above each step.
 * 
 * FIXED: Now properly generates candidate texts for Scenario Outline steps
 * by expanding <placeholders> with Examples values.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolveResult, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword, FeatureStep } from '../../core/domain';

interface StepCodeLens extends vscode.CodeLens {
    stepText: string;
    keyword: string;
    lineIndex: number;
    result?: ResolveResult;
}

// Placeholder pattern
const PLACEHOLDER_REGEX = /<([^>]+)>/g;

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
        
        // Track if we're in a Scenario Outline and capture Examples
        let inScenarioOutline = false;
        let currentExamples: { headers: string[], rows: string[][] }[] = [];
        let currentExampleBlock: { headers: string[], rows: string[][] } | null = null;
        
        // First pass: collect Examples data
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (/^\s*Scenario Outline:/i.test(line)) {
                inScenarioOutline = true;
                currentExamples = [];
                currentExampleBlock = null;
            } else if (/^\s*(Scenario|Feature|Background):/i.test(line)) {
                inScenarioOutline = false;
                currentExamples = [];
                currentExampleBlock = null;
            } else if (/^\s*Examples:/i.test(line) && inScenarioOutline) {
                currentExampleBlock = { headers: [], rows: [] };
                currentExamples.push(currentExampleBlock);
            } else if (trimmed.startsWith('|') && currentExampleBlock) {
                const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
                if (currentExampleBlock.headers.length === 0) {
                    currentExampleBlock.headers = cells;
                } else {
                    currentExampleBlock.rows.push(cells);
                }
            }
        }
        
        // Reset tracking
        inScenarioOutline = false;
        currentExamples = [];
        currentExampleBlock = null;
        let outlineExamples: { headers: string[], rows: string[][] }[] = [];
        
        // Second pass: create CodeLenses with proper context
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Track tags
            const tagMatch = line.match(/^\s*(@\S+(?:\s+@\S+)*)\s*$/);
            if (tagMatch) {
                currentTags = tagMatch[1].split(/\s+/).filter(t => t.startsWith('@'));
                continue;
            }
            
            // Track Scenario Outline
            if (/^\s*Scenario Outline:/i.test(line)) {
                inScenarioOutline = true;
                outlineExamples = [];
                currentExampleBlock = null;
                currentTags = [];
                continue;
            }
            
            // Track regular Scenario/Feature/Background (ends outline)
            if (/^\s*(Scenario|Feature|Background):/i.test(line)) {
                inScenarioOutline = false;
                outlineExamples = [];
                currentExampleBlock = null;
                currentTags = [];
                continue;
            }
            
            // Track Examples blocks
            if (/^\s*Examples:/i.test(line) && inScenarioOutline) {
                currentExampleBlock = { headers: [], rows: [] };
                outlineExamples.push(currentExampleBlock);
                continue;
            }
            
            // Track table rows
            if (trimmed.startsWith('|') && currentExampleBlock) {
                const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
                if (currentExampleBlock.headers.length === 0) {
                    currentExampleBlock.headers = cells;
                } else if (currentExampleBlock.rows.length < 20) {
                    currentExampleBlock.rows.push(cells);
                }
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
                    { 
                        stepText: text, 
                        keyword,
                        lineIndex: i,
                        // Store examples for use in resolveCodeLens
                        _examples: inScenarioOutline ? [...outlineExamples] : undefined
                    }
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
        const stepLens = codeLens as StepCodeLens & { _examples?: { headers: string[], rows: string[][] }[] };
        const index = this.indexManager.getIndex();
        
        // Get bindings for all keyword types (for And/But compatibility)
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            codeLens.command = {
                title: '$(warning) No bindings indexed - click to reindex',
                command: 'reqnroll-navigator.reindexWorkspace',
            };
            return codeLens;
        }
        
        // Create resolver
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);
        
        // Build candidate texts for matching
        const candidateTexts = this.generateCandidateTexts(stepLens.stepText, stepLens._examples);
        
        // Build step for resolution
        const resolvedKeyword = this.normalizeKeyword(stepLens.keyword);
        const step: FeatureStep = {
            keywordOriginal: stepLens.keyword as any,
            keywordResolved: resolvedKeyword,
            rawText: stepLens.stepText,
            normalizedText: stepLens.stepText.replace(/\s+/g, ' ').trim(),
            fullText: `${stepLens.keyword} ${stepLens.stepText}`,
            tagsEffective: [],
            uri: vscode.Uri.file(''),
            range: codeLens.range,
            lineNumber: codeLens.range.start.line,
            isOutline: Boolean(stepLens._examples && stepLens._examples.length > 0),
            candidateTexts: candidateTexts,
        };
        
        const result = resolve(step);
        stepLens.result = result;
        
        if (result.candidates.length === 0) {
            codeLens.command = {
                title: '$(error) No binding found',
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
                title: `$(symbol-method) ${best.binding.methodName} +${result.candidates.length - 1} more (ambiguous)`,
                command: 'reqnroll-navigator.goToStep',
                arguments: [result],
            };
        }
        
        return codeLens;
    }
    
    /**
     * Generate candidate texts for matching.
     * For Scenario Outline steps, expands <placeholders> with Examples values.
     */
    private generateCandidateTexts(
        stepText: string, 
        examples?: { headers: string[], rows: string[][] }[]
    ): string[] {
        const candidates: string[] = [];
        const normalizedText = stepText.replace(/\s+/g, ' ').trim();
        
        // Check if text contains placeholders
        const hasPlaceholders = PLACEHOLDER_REGEX.test(normalizedText);
        PLACEHOLDER_REGEX.lastIndex = 0;
        
        // Fallback candidate: replace <placeholder> with X
        const fallbackCandidate = normalizedText.replace(PLACEHOLDER_REGEX, 'X');
        candidates.push(fallbackCandidate);
        
        // If no placeholders or no examples, return just the fallback
        if (!hasPlaceholders || !examples || examples.length === 0) {
            return candidates;
        }
        
        // Expand placeholders with actual values from Examples
        for (const example of examples) {
            if (example.headers.length === 0) continue;
            
            const maxRows = Math.min(example.rows.length, 20);
            
            for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
                if (candidates.length >= 25) break;
                
                const row = example.rows[rowIdx];
                let expandedText = normalizedText;
                
                // Replace each placeholder with the corresponding value
                for (let colIdx = 0; colIdx < example.headers.length; colIdx++) {
                    const placeholder = `<${example.headers[colIdx]}>`;
                    const value = row[colIdx] ?? 'X';
                    expandedText = expandedText.split(placeholder).join(value);
                }
                
                // Normalize
                expandedText = expandedText.replace(/\s+/g, ' ').trim();
                
                // Add if unique
                if (!candidates.includes(expandedText)) {
                    candidates.push(expandedText);
                }
            }
        }
        
        return candidates;
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
