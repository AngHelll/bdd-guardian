/**
 * Decorations Manager - Visual indicators for step status.
 * 
 * Features:
 * - Gutter icons (checkmark, X, warning)
 * - Subtle left border by status
 * - Overview ruler markers
 * - Debounced updates (200ms)
 * - Respects user configuration
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword } from '../../core/domain';
import { StepStatus, getUIConfig, getStatusEmoji } from '../../ui/stepStatus';

// Placeholder regex for Scenario Outline detection
const PLACEHOLDER_REGEX = /<([^>]+)>/g;

// Debounce timer
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 200;

/**
 * Get the extension's root path for resource loading
 */
function getExtensionPath(): string {
    const ext = vscode.extensions.getExtension('anghelll.bdd-guardian') 
        ?? vscode.extensions.getExtension('anghelll.reqnroll-navigator');
    if (ext) {
        return ext.extensionPath;
    }
    return path.resolve(__dirname, '..', '..', '..');
}

/**
 * Create decoration type with optional gutter icon.
 */
function createDecorationType(
    iconName: string,
    borderColor: string,
    overviewColor: string,
    useGutterIcon: boolean
): vscode.TextEditorDecorationType {
    const extensionPath = getExtensionPath();
    const iconPath = path.join(extensionPath, 'resources', 'icons', `${iconName}.svg`);
    
    const options: vscode.DecorationRenderOptions = {
        borderWidth: '0 0 0 2px',
        borderStyle: 'solid',
        borderColor: new vscode.ThemeColor(borderColor),
        overviewRulerColor: new vscode.ThemeColor(overviewColor),
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        isWholeLine: false,
    };
    
    if (useGutterIcon) {
        options.gutterIconPath = iconPath;
        options.gutterIconSize = 'contain';
    }
    
    return vscode.window.createTextEditorDecorationType(options);
}

// Decoration type cache
const decorationTypes: {
    bound: vscode.TextEditorDecorationType | null;
    unbound: vscode.TextEditorDecorationType | null;
    ambiguous: vscode.TextEditorDecorationType | null;
} = {
    bound: null,
    unbound: null,
    ambiguous: null,
};

/**
 * Initialize or reinitialize decoration types based on config.
 */
function initDecorationTypes(useGutterIcons: boolean): void {
    // Dispose existing
    decorationTypes.bound?.dispose();
    decorationTypes.unbound?.dispose();
    decorationTypes.ambiguous?.dispose();
    
    decorationTypes.bound = createDecorationType('bound', 'charts.green', 'charts.green', useGutterIcons);
    decorationTypes.unbound = createDecorationType('unbound', 'charts.red', 'charts.red', useGutterIcons);
    decorationTypes.ambiguous = createDecorationType('ambiguous', 'charts.yellow', 'charts.yellow', useGutterIcons);
}

export interface DecorationStats {
    bound: number;
    unbound: number;
    ambiguous: number;
}

export class DecorationsManager {
    private disposables: vscode.Disposable[] = [];
    private lastConfig: { gutterIcons: boolean } | null = null;
    
    constructor(private indexManager: IndexManager) {
        // Listen for config changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('bddGuardian') || e.affectsConfiguration('reqnrollNavigator')) {
                    this.onConfigChange();
                }
            })
        );
    }
    
    /**
     * Handle configuration changes.
     */
    private onConfigChange(): void {
        const uiConfig = getUIConfig();
        if (this.lastConfig?.gutterIcons !== uiConfig.gutterIconsEnabled) {
            initDecorationTypes(uiConfig.gutterIconsEnabled);
            this.lastConfig = { gutterIcons: uiConfig.gutterIconsEnabled };
            
            // Re-apply decorations to active editor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                this.updateDecorationsImmediate(editor);
            }
        }
    }
    
    /**
     * Update decorations with debounce.
     */
    public updateDecorations(editor: vscode.TextEditor | undefined): void {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
            if (editor && editor === vscode.window.activeTextEditor) {
                this.updateDecorationsImmediate(editor);
            }
        }, DEBOUNCE_MS);
    }
    
    /**
     * Update decorations immediately (for forced refresh).
     */
    public updateDecorationsImmediate(editor: vscode.TextEditor | undefined): DecorationStats {
        const stats: DecorationStats = { bound: 0, unbound: 0, ambiguous: 0 };
        
        if (!editor || !editor.document.fileName.endsWith('.feature')) {
            return stats;
        }
        
        const config = getConfig();
        const uiConfig = getUIConfig();
        
        if (!uiConfig.decorationsEnabled) {
            this.clearDecorations(editor);
            return stats;
        }
        
        // Initialize decoration types if needed
        if (!decorationTypes.bound || this.lastConfig?.gutterIcons !== uiConfig.gutterIconsEnabled) {
            initDecorationTypes(uiConfig.gutterIconsEnabled);
            this.lastConfig = { gutterIcons: uiConfig.gutterIconsEnabled };
        }
        
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            this.clearDecorations(editor);
            return stats;
        }
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);
        
        const document = editor.document;
        const lines = document.getText().split('\n');
        
        const boundRanges: vscode.DecorationOptions[] = [];
        const unboundRanges: vscode.DecorationOptions[] = [];
        const ambiguousRanges: vscode.DecorationOptions[] = [];
        
        let currentTags: string[] = [];
        let prevResolvedKeyword: ResolvedKeyword = 'Given';
        
        // Track Scenario Outline context
        let inScenarioOutline = false;
        let outlineExamples: { headers: string[], rows: string[][] }[] = [];
        let currentExampleBlock: { headers: string[], rows: string[][] } | null = null;
        
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
                prevResolvedKeyword = 'Given';
                continue;
            }
            
            // Reset on regular Scenario/Feature/Background
            if (/^\s*(Scenario|Feature|Background):/i.test(line)) {
                inScenarioOutline = false;
                outlineExamples = [];
                currentExampleBlock = null;
                currentTags = [];
                prevResolvedKeyword = 'Given';
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
            if (!stepMatch) continue;
            
            // Apply tag filter
            if (config.tagFilter.length > 0 && !shouldShowStep(currentTags)) {
                continue;
            }
            
            const keyword = stepMatch[1];
            const text = stepMatch[2].trim();
            const resolvedKeyword = this.resolveKeyword(keyword, prevResolvedKeyword);
            prevResolvedKeyword = resolvedKeyword;
            
            // Generate candidate texts for matching
            const candidateTexts = this.generateCandidateTexts(
                text, 
                inScenarioOutline ? outlineExamples : undefined
            );
            
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
                isOutline: inScenarioOutline,
                candidateTexts: candidateTexts,
            };
            
            const result = resolve(step as any);
            const range = new vscode.Range(i, 0, i, line.length);
            
            // Determine status
            let status: StepStatus;
            if (result.status === 'unbound') {
                status = StepStatus.Unbound;
                stats.unbound++;
            } else if (result.status === 'ambiguous') {
                status = StepStatus.Ambiguous;
                stats.ambiguous++;
            } else {
                status = StepStatus.Bound;
                stats.bound++;
            }
            
            // Create decoration option with minimal hover
            const decorationOption: vscode.DecorationOptions = {
                range,
                hoverMessage: this.createMinimalHover(status, result.candidates.length),
            };
            
            // Add to appropriate array
            if (status === StepStatus.Unbound) {
                unboundRanges.push(decorationOption);
            } else if (status === StepStatus.Ambiguous) {
                ambiguousRanges.push(decorationOption);
            } else {
                boundRanges.push(decorationOption);
            }
        }
        
        // Apply decorations
        if (decorationTypes.bound) {
            editor.setDecorations(decorationTypes.bound, boundRanges);
        }
        if (decorationTypes.unbound) {
            editor.setDecorations(decorationTypes.unbound, unboundRanges);
        }
        if (decorationTypes.ambiguous) {
            editor.setDecorations(decorationTypes.ambiguous, ambiguousRanges);
        }
        
        return stats;
    }
    
    /**
     * Generate candidate texts for matching, expanding placeholders with Examples values.
     */
    private generateCandidateTexts(
        stepText: string,
        examples?: { headers: string[], rows: string[][] }[]
    ): string[] {
        const candidates: string[] = [];
        const normalizedText = stepText.replace(/\s+/g, ' ').trim();
        
        const hasPlaceholders = PLACEHOLDER_REGEX.test(normalizedText);
        PLACEHOLDER_REGEX.lastIndex = 0;
        
        const fallbackCandidate = normalizedText.replace(PLACEHOLDER_REGEX, 'X');
        candidates.push(fallbackCandidate);
        
        if (!hasPlaceholders || !examples || examples.length === 0) {
            return candidates;
        }
        
        for (const example of examples) {
            if (example.headers.length === 0) continue;
            
            const maxRows = Math.min(example.rows.length, 20);
            for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
                if (candidates.length >= 25) break;
                
                const row = example.rows[rowIdx];
                let expandedText = normalizedText;
                
                for (let colIdx = 0; colIdx < example.headers.length; colIdx++) {
                    const placeholder = `<${example.headers[colIdx]}>`;
                    const value = row[colIdx] ?? 'X';
                    expandedText = expandedText.split(placeholder).join(value);
                }
                
                expandedText = expandedText.replace(/\s+/g, ' ').trim();
                
                if (!candidates.includes(expandedText)) {
                    candidates.push(expandedText);
                }
            }
        }
        
        return candidates;
    }
    
    /**
     * Create minimal hover message for decoration.
     * Full details are in the HoverProvider.
     */
    private createMinimalHover(status: StepStatus, candidateCount: number): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        const emoji = getStatusEmoji(status);
        
        switch (status) {
            case StepStatus.Bound:
                md.appendMarkdown(`${emoji} **Bound**`);
                break;
            case StepStatus.Ambiguous:
                md.appendMarkdown(`${emoji} **Ambiguous** (${candidateCount} matches)`);
                break;
            case StepStatus.Unbound:
                md.appendMarkdown(`${emoji} **Unbound**`);
                break;
        }
        
        return md;
    }
    
    /**
     * Clear all decorations from editor.
     */
    public clearDecorations(editor: vscode.TextEditor): void {
        if (decorationTypes.bound) {
            editor.setDecorations(decorationTypes.bound, []);
        }
        if (decorationTypes.unbound) {
            editor.setDecorations(decorationTypes.unbound, []);
        }
        if (decorationTypes.ambiguous) {
            editor.setDecorations(decorationTypes.ambiguous, []);
        }
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
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        decorationTypes.bound?.dispose();
        decorationTypes.unbound?.dispose();
        decorationTypes.ambiguous?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
