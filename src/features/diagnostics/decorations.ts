/**
 * Decorations Manager - Visual indicators for step status.
 * 
 * Phase 3: Enhanced with Gutter Icons
 * - Green checkmark for bound steps
 * - Red X for unbound steps
 * - Orange ! for ambiguous steps
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword } from '../../core/domain';

/**
 * Get the extension's root path for resource loading
 */
function getExtensionPath(): string {
    // Try to get from extension context, fallback to __dirname
    const ext = vscode.extensions.getExtension('anghelll.reqnroll-navigator');
    if (ext) {
        return ext.extensionPath;
    }
    // Fallback: navigate from out/ to root
    return path.resolve(__dirname, '..', '..', '..');
}

/**
 * Create decoration type with gutter icon
 */
function createDecorationWithGutter(
    iconName: string,
    borderColor: string,
    overviewColor: string
): vscode.TextEditorDecorationType {
    const extensionPath = getExtensionPath();
    const iconPath = path.join(extensionPath, 'resources', 'icons', `${iconName}.svg`);
    
    return vscode.window.createTextEditorDecorationType({
        gutterIconPath: iconPath,
        gutterIconSize: 'contain',
        borderWidth: '0 0 0 3px',
        borderStyle: 'solid',
        borderColor: new vscode.ThemeColor(borderColor),
        overviewRulerColor: new vscode.ThemeColor(overviewColor),
        overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
}

// Decoration types for different statuses - created lazily
let boundDecoration: vscode.TextEditorDecorationType | null = null;
let unboundDecoration: vscode.TextEditorDecorationType | null = null;
let ambiguousDecoration: vscode.TextEditorDecorationType | null = null;

function getBoundDecoration(): vscode.TextEditorDecorationType {
    if (!boundDecoration) {
        boundDecoration = createDecorationWithGutter('bound', 'charts.green', 'charts.green');
    }
    return boundDecoration;
}

function getUnboundDecoration(): vscode.TextEditorDecorationType {
    if (!unboundDecoration) {
        unboundDecoration = createDecorationWithGutter('unbound', 'charts.red', 'charts.red');
    }
    return unboundDecoration;
}

function getAmbiguousDecoration(): vscode.TextEditorDecorationType {
    if (!ambiguousDecoration) {
        ambiguousDecoration = createDecorationWithGutter('ambiguous', 'charts.yellow', 'charts.yellow');
    }
    return ambiguousDecoration;
}

export interface DecorationStats {
    bound: number;
    unbound: number;
    ambiguous: number;
}

// Placeholder regex for Scenario Outline detection
const PLACEHOLDER_REGEX = /<([^>]+)>/g;

export class DecorationsManager {
    private disposables: vscode.Disposable[] = [];
    
    constructor(private indexManager: IndexManager) {}
    
    /**
     * Update decorations for the active editor.
     */
    public updateDecorations(editor: vscode.TextEditor | undefined): DecorationStats {
        const stats: DecorationStats = { bound: 0, unbound: 0, ambiguous: 0 };
        
        if (!editor || !editor.document.fileName.endsWith('.feature')) {
            return stats;
        }
        
        const config = getConfig();
        if (!config.enableDecorations) {
            this.clearDecorations(editor);
            return stats;
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
        
        // Track Scenario Outline context for candidate generation
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
        
        // Reset for second pass
        inScenarioOutline = false;
        currentExamples = [];
        currentExampleBlock = null;
        let outlineExamples: { headers: string[], rows: string[][] }[] = [];
        
        // Second pass: create decorations
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
            if (config.tagFilter.length > 0) {
                if (!shouldShowStep(currentTags)) {
                    continue;
                }
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
            
            // Create decoration option with hover message
            const decorationOption: vscode.DecorationOptions = {
                range,
                hoverMessage: this.createHoverMessage(result.status, result.candidates.length),
            };
            
            if (result.status === 'unbound') {
                unboundRanges.push(decorationOption);
                stats.unbound++;
            } else if (result.status === 'ambiguous') {
                ambiguousRanges.push(decorationOption);
                stats.ambiguous++;
            } else {
                boundRanges.push(decorationOption);
                stats.bound++;
            }
        }
        
        editor.setDecorations(getBoundDecoration(), boundRanges);
        editor.setDecorations(getUnboundDecoration(), unboundRanges);
        editor.setDecorations(getAmbiguousDecoration(), ambiguousRanges);
        
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
        
        // Check for placeholders
        const hasPlaceholders = PLACEHOLDER_REGEX.test(normalizedText);
        PLACEHOLDER_REGEX.lastIndex = 0;
        
        // Fallback: replace placeholders with X
        const fallbackCandidate = normalizedText.replace(PLACEHOLDER_REGEX, 'X');
        candidates.push(fallbackCandidate);
        
        if (!hasPlaceholders || !examples || examples.length === 0) {
            return candidates;
        }
        
        // Expand with actual Example values
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
     * Create hover message for decoration
     */
    private createHoverMessage(status: string, candidateCount: number): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        
        if (status === 'bound') {
            md.appendMarkdown('✅ **Bound** - Step has a matching binding');
        } else if (status === 'ambiguous') {
            md.appendMarkdown(`⚠️ **Ambiguous** - ${candidateCount} bindings match this step`);
        } else {
            md.appendMarkdown('❌ **Unbound** - No binding found for this step');
        }
        
        return md;
    }
    
    /**
     * Clear all decorations from editor.
     */
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(getBoundDecoration(), []);
        editor.setDecorations(getUnboundDecoration(), []);
        editor.setDecorations(getAmbiguousDecoration(), []);
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
        boundDecoration?.dispose();
        unboundDecoration?.dispose();
        ambiguousDecoration?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
