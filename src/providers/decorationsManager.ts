/**
 * Decorations Manager
 * Provides visual status cues for step bindings in .feature files
 * 
 * Applies decorations (left border) to indicate:
 * - Bound: step has a matching binding
 * - Ambiguous: step has multiple matching bindings
 * - Unbound: step has no matching binding
 * 
 * Respects tag filtering: filtered-out steps are not decorated.
 * Uses debouncing to avoid heavy recomputation on every keystroke.
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { StepMatcher } from '../matcher';
import { getTagFilterConfig, shouldShowStep } from '../types';

// Debounce delay for decoration refresh (ms)
const DEBOUNCE_DELAY = 200;

export class DecorationsManager implements vscode.Disposable {
    // Decoration types for different binding statuses
    private boundDecorationType: vscode.TextEditorDecorationType;
    private ambiguousDecorationType: vscode.TextEditorDecorationType;
    private unboundDecorationType: vscode.TextEditorDecorationType;

    // Debounce timer
    private debounceTimer: NodeJS.Timeout | undefined;

    // Subscriptions
    private disposables: vscode.Disposable[] = [];

    constructor(
        private featureIndexer: FeatureIndexer,
        private stepMatcher: StepMatcher
    ) {
        // Create decoration types with subtle left borders
        this.boundDecorationType = vscode.window.createTextEditorDecorationType({
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid',
            borderColor: new vscode.ThemeColor('charts.green'),
            overviewRulerColor: new vscode.ThemeColor('charts.green'),
            overviewRulerLane: vscode.OverviewRulerLane.Left,
        });

        this.ambiguousDecorationType = vscode.window.createTextEditorDecorationType({
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid',
            borderColor: new vscode.ThemeColor('charts.yellow'),
            overviewRulerColor: new vscode.ThemeColor('charts.yellow'),
            overviewRulerLane: vscode.OverviewRulerLane.Left,
        });

        this.unboundDecorationType = vscode.window.createTextEditorDecorationType({
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid',
            borderColor: new vscode.ThemeColor('charts.red'),
            overviewRulerColor: new vscode.ThemeColor('charts.red'),
            overviewRulerLane: vscode.OverviewRulerLane.Left,
        });

        // Subscribe to editor events
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.scheduleRefresh()),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (this.isFeatureDocument(e.document)) {
                    this.scheduleRefresh();
                }
            })
        );
    }

    /**
     * Check if a document is a feature file
     */
    private isFeatureDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'gherkin' || document.fileName.endsWith('.feature');
    }

    /**
     * Schedule a debounced refresh of decorations
     */
    public scheduleRefresh(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.refreshDecorations();
        }, DEBOUNCE_DELAY);
    }

    /**
     * Refresh decorations for the active editor
     */
    public refreshDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor || !this.isFeatureDocument(editor.document)) {
            return;
        }

        this.applyDecorations(editor);
    }

    /**
     * Apply decorations to a text editor
     */
    private applyDecorations(editor: vscode.TextEditor): void {
        const document = editor.document;
        const feature = this.featureIndexer.getFeatureByUri(document.uri);

        if (!feature) {
            // Clear decorations if no feature found
            editor.setDecorations(this.boundDecorationType, []);
            editor.setDecorations(this.ambiguousDecorationType, []);
            editor.setDecorations(this.unboundDecorationType, []);
            return;
        }

        const boundRanges: vscode.DecorationOptions[] = [];
        const ambiguousRanges: vscode.DecorationOptions[] = [];
        const unboundRanges: vscode.DecorationOptions[] = [];

        // Get tag filter config
        const filterConfig = getTagFilterConfig();

        for (const step of feature.allSteps) {
            // Respect tag filtering: skip filtered-out steps
            if (!shouldShowStep(step, filterConfig)) {
                continue;
            }

            const matchResult = this.stepMatcher.matchStep(step);
            const decoration: vscode.DecorationOptions = {
                range: step.range,
            };

            switch (matchResult.status) {
                case 'bound':
                    boundRanges.push(decoration);
                    break;
                case 'ambiguous':
                    ambiguousRanges.push(decoration);
                    break;
                case 'unbound':
                    unboundRanges.push(decoration);
                    break;
            }
        }

        // Apply decorations
        editor.setDecorations(this.boundDecorationType, boundRanges);
        editor.setDecorations(this.ambiguousDecorationType, ambiguousRanges);
        editor.setDecorations(this.unboundDecorationType, unboundRanges);
    }

    /**
     * Clear all decorations from all editors
     */
    public clearAllDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            if (this.isFeatureDocument(editor.document)) {
                editor.setDecorations(this.boundDecorationType, []);
                editor.setDecorations(this.ambiguousDecorationType, []);
                editor.setDecorations(this.unboundDecorationType, []);
            }
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.boundDecorationType.dispose();
        this.ambiguousDecorationType.dispose();
        this.unboundDecorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
