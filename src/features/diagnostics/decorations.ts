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
import { createResolver, applyMatchingSettings, ResolverDependencies } from '../../core/matching';
import { getConfig, shouldShowStep } from '../../config';
import { ResolvedKeyword } from '../../core/domain';
import { StepStatus, getUIConfig, getStatusEmoji, getStatusLabel, getAmbiguousStatusLabel } from '../../ui/stepStatus';
import { parseFeatureDocument } from '../../core/parsing/gherkinParser';

// Debounce timer
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 200;

/**
 * Get the extension's root path for resource loading
 */
function getExtensionPath(): string {
    const ext = vscode.extensions.getExtension('anghelll-bdd-guardian.bdd-guardian') 
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
        const resolve = createResolver(applyMatchingSettings(deps));
        
        const document = editor.document;
        const parsed = parseFeatureDocument(document);
        const steps = parsed?.allSteps ?? [];
        
        const boundRanges: vscode.DecorationOptions[] = [];
        const unboundRanges: vscode.DecorationOptions[] = [];
        const ambiguousRanges: vscode.DecorationOptions[] = [];
        
        for (const step of steps) {
            if (config.tagFilter.length > 0 && !shouldShowStep(step.tagsEffective)) {
                continue;
            }

            const result = resolve(step);
            
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
            
            const decorationOption: vscode.DecorationOptions = {
                range: step.range,
                hoverMessage: this.createMinimalHover(status, result.candidates.length),
            };
            
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
     * Create minimal hover message for decoration.
     * Full details are in the HoverProvider.
     */
    private createMinimalHover(status: StepStatus, candidateCount: number): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        const emoji = getStatusEmoji(status);
        switch (status) {
            case StepStatus.Bound:
                md.appendMarkdown(`${emoji} **${getStatusLabel(StepStatus.Bound)}**`);
                break;
            case StepStatus.Ambiguous:
                md.appendMarkdown(`${emoji} **${getAmbiguousStatusLabel(candidateCount)}**`);
                break;
            case StepStatus.Unbound:
                md.appendMarkdown(`${emoji} **${getStatusLabel(StepStatus.Unbound)}**`);
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
