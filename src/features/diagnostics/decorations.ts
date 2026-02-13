/**
 * Decorations Manager - Visual indicators for step status.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword, MatchStatus } from '../../core/domain';

// Decoration types for different statuses
const boundDecoration = vscode.window.createTextEditorDecorationType({
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('charts.green'),
    overviewRulerColor: new vscode.ThemeColor('charts.green'),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
});

const unboundDecoration = vscode.window.createTextEditorDecorationType({
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('charts.red'),
    overviewRulerColor: new vscode.ThemeColor('charts.red'),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
});

const ambiguousDecoration = vscode.window.createTextEditorDecorationType({
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('charts.yellow'),
    overviewRulerColor: new vscode.ThemeColor('charts.yellow'),
    overviewRulerLane: vscode.OverviewRulerLane.Left,
});

export interface DecorationStats {
    bound: number;
    unbound: number;
    ambiguous: number;
}

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
        
        const boundRanges: vscode.Range[] = [];
        const unboundRanges: vscode.Range[] = [];
        const ambiguousRanges: vscode.Range[] = [];
        
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
            const range = new vscode.Range(i, 0, i, line.length);
            
            if (result.status === 'unbound') {
                unboundRanges.push(range);
                stats.unbound++;
            } else if (result.status === 'ambiguous') {
                ambiguousRanges.push(range);
                stats.ambiguous++;
            } else {
                boundRanges.push(range);
                stats.bound++;
            }
        }
        
        editor.setDecorations(boundDecoration, boundRanges);
        editor.setDecorations(unboundDecoration, unboundRanges);
        editor.setDecorations(ambiguousDecoration, ambiguousRanges);
        
        return stats;
    }
    
    /**
     * Clear all decorations from editor.
     */
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(boundDecoration, []);
        editor.setDecorations(unboundDecoration, []);
        editor.setDecorations(ambiguousDecoration, []);
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
        boundDecoration.dispose();
        unboundDecoration.dispose();
        ambiguousDecoration.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
