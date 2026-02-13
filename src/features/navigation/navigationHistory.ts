/**
 * Navigation History - Back/Forward navigation for step bindings
 * 
 * Provides a custom navigation stack that tracks:
 * - Feature step → Binding navigation
 * - Binding → Feature step navigation (reverse lookup)
 * 
 * Commands:
 * - reqnroll-navigator.goBack (Alt+Left)
 * - reqnroll-navigator.goForward (Alt+Right)
 */

import * as vscode from 'vscode';

/**
 * Represents a location in the navigation history
 */
export interface NavigationLocation {
    uri: vscode.Uri;
    line: number;
    character: number;
    type: 'feature' | 'binding' | 'other';
    label?: string; // e.g., step text or method name
    timestamp: number;
}

/**
 * Navigation History Manager
 * 
 * Maintains a stack-based history with back/forward navigation.
 * Maximum history size is configurable.
 */
export class NavigationHistoryManager {
    private history: NavigationLocation[] = [];
    private currentIndex: number = -1;
    private maxSize: number;
    private isNavigating: boolean = false;
    
    private _onDidChangeHistory = new vscode.EventEmitter<void>();
    public readonly onDidChangeHistory = this._onDidChangeHistory.event;
    
    constructor(maxSize: number = 50) {
        this.maxSize = maxSize;
    }
    
    /**
     * Push a new location to the history.
     * Clears forward history if we're not at the end.
     */
    public push(location: Omit<NavigationLocation, 'timestamp'>): void {
        // Don't record if we're in the middle of a back/forward navigation
        if (this.isNavigating) {
            return;
        }
        
        const newLocation: NavigationLocation = {
            ...location,
            timestamp: Date.now(),
        };
        
        // Check if this is the same location as current
        if (this.currentIndex >= 0) {
            const current = this.history[this.currentIndex];
            if (this.isSameLocation(current, newLocation)) {
                return; // Don't add duplicate
            }
        }
        
        // Clear forward history
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        // Add new location
        this.history.push(newLocation);
        this.currentIndex = this.history.length - 1;
        
        // Trim history if too large
        if (this.history.length > this.maxSize) {
            const excess = this.history.length - this.maxSize;
            this.history = this.history.slice(excess);
            this.currentIndex = Math.max(0, this.currentIndex - excess);
        }
        
        this._onDidChangeHistory.fire();
    }
    
    /**
     * Record current editor position before navigation
     */
    public recordCurrentPosition(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const doc = editor.document;
        const pos = editor.selection.active;
        
        this.push({
            uri: doc.uri,
            line: pos.line,
            character: pos.character,
            type: this.getLocationType(doc),
            label: this.getLocationLabel(doc, pos.line),
        });
    }
    
    /**
     * Navigate back in history
     */
    public async goBack(): Promise<boolean> {
        if (!this.canGoBack()) {
            return false;
        }
        
        this.isNavigating = true;
        try {
            this.currentIndex--;
            const location = this.history[this.currentIndex];
            await this.navigateToLocation(location);
            this._onDidChangeHistory.fire();
            return true;
        } finally {
            this.isNavigating = false;
        }
    }
    
    /**
     * Navigate forward in history
     */
    public async goForward(): Promise<boolean> {
        if (!this.canGoForward()) {
            return false;
        }
        
        this.isNavigating = true;
        try {
            this.currentIndex++;
            const location = this.history[this.currentIndex];
            await this.navigateToLocation(location);
            this._onDidChangeHistory.fire();
            return true;
        } finally {
            this.isNavigating = false;
        }
    }
    
    /**
     * Check if we can go back
     */
    public canGoBack(): boolean {
        return this.currentIndex > 0;
    }
    
    /**
     * Check if we can go forward
     */
    public canGoForward(): boolean {
        return this.currentIndex < this.history.length - 1;
    }
    
    /**
     * Get current history state for status bar
     */
    public getState(): { canBack: boolean; canForward: boolean; size: number; index: number } {
        return {
            canBack: this.canGoBack(),
            canForward: this.canGoForward(),
            size: this.history.length,
            index: this.currentIndex,
        };
    }
    
    /**
     * Get recent history for quick pick
     */
    public getRecentHistory(limit: number = 10): NavigationLocation[] {
        const start = Math.max(0, this.history.length - limit);
        return this.history.slice(start).reverse();
    }
    
    /**
     * Clear all history
     */
    public clear(): void {
        this.history = [];
        this.currentIndex = -1;
        this._onDidChangeHistory.fire();
    }
    
    /**
     * Navigate to a specific location
     */
    private async navigateToLocation(location: NavigationLocation): Promise<void> {
        const position = new vscode.Position(location.line, location.character);
        
        await vscode.commands.executeCommand('vscode.open', location.uri, {
            selection: new vscode.Range(position, position),
            preview: false,
        });
    }
    
    /**
     * Check if two locations are the same
     */
    private isSameLocation(a: NavigationLocation, b: NavigationLocation): boolean {
        return a.uri.toString() === b.uri.toString() &&
               a.line === b.line &&
               Math.abs(a.character - b.character) < 5; // Allow small character differences
    }
    
    /**
     * Determine the type of a document
     */
    private getLocationType(doc: vscode.TextDocument): 'feature' | 'binding' | 'other' {
        if (doc.fileName.endsWith('.feature')) {
            return 'feature';
        }
        if (doc.fileName.endsWith('.cs') || 
            doc.fileName.endsWith('.ts') || 
            doc.fileName.endsWith('.js') ||
            doc.fileName.endsWith('.py') ||
            doc.fileName.endsWith('.java') ||
            doc.fileName.endsWith('.go')) {
            return 'binding';
        }
        return 'other';
    }
    
    /**
     * Get a label for the location
     */
    private getLocationLabel(doc: vscode.TextDocument, line: number): string {
        const lineText = doc.lineAt(line).text.trim();
        
        // For feature files, try to get step text
        const stepMatch = lineText.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i);
        if (stepMatch) {
            const text = stepMatch[2];
            return text.length > 50 ? text.substring(0, 47) + '...' : text;
        }
        
        // For binding files, try to get method name
        const methodMatch = lineText.match(/(?:public|private|protected)\s+\w+\s+(\w+)\s*\(/);
        if (methodMatch) {
            return methodMatch[1];
        }
        
        // Fallback
        return lineText.length > 50 ? lineText.substring(0, 47) + '...' : lineText;
    }
    
    /**
     * Dispose resources
     */
    public dispose(): void {
        this._onDidChangeHistory.dispose();
    }
}

// Singleton instance
let historyManager: NavigationHistoryManager | null = null;

/**
 * Get the navigation history manager singleton
 */
export function getNavigationHistory(): NavigationHistoryManager {
    if (!historyManager) {
        historyManager = new NavigationHistoryManager();
    }
    return historyManager;
}

/**
 * Create navigation history commands and register them
 */
export function createNavigationHistoryCommands(
    context: vscode.ExtensionContext
): vscode.Disposable[] {
    const history = getNavigationHistory();
    const disposables: vscode.Disposable[] = [];
    
    // Go Back command
    disposables.push(
        vscode.commands.registerCommand('reqnroll-navigator.goBack', async () => {
            const success = await history.goBack();
            if (!success) {
                vscode.window.setStatusBarMessage('$(arrow-left) No previous location', 2000);
            }
        })
    );
    
    // Go Forward command
    disposables.push(
        vscode.commands.registerCommand('reqnroll-navigator.goForward', async () => {
            const success = await history.goForward();
            if (!success) {
                vscode.window.setStatusBarMessage('$(arrow-right) No next location', 2000);
            }
        })
    );
    
    // Show History command
    disposables.push(
        vscode.commands.registerCommand('reqnroll-navigator.showHistory', async () => {
            const recentHistory = history.getRecentHistory(20);
            
            if (recentHistory.length === 0) {
                vscode.window.showInformationMessage('No navigation history');
                return;
            }
            
            const items = recentHistory.map((loc, idx) => ({
                label: `${loc.type === 'feature' ? '$(file)' : '$(symbol-method)'} ${loc.label || 'Unknown'}`,
                description: vscode.workspace.asRelativePath(loc.uri),
                detail: `Line ${loc.line + 1}`,
                location: loc,
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a location from history',
                matchOnDescription: true,
            });
            
            if (selected) {
                const position = new vscode.Position(selected.location.line, selected.location.character);
                await vscode.commands.executeCommand('vscode.open', selected.location.uri, {
                    selection: new vscode.Range(position, position),
                });
            }
        })
    );
    
    // Clear History command
    disposables.push(
        vscode.commands.registerCommand('reqnroll-navigator.clearHistory', () => {
            history.clear();
            vscode.window.showInformationMessage('Navigation history cleared');
        })
    );
    
    return disposables;
}

/**
 * Create a status bar item showing navigation state
 */
export function createNavigationStatusBar(): vscode.StatusBarItem {
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    
    const history = getNavigationHistory();
    
    const updateStatusBar = () => {
        const state = history.getState();
        
        if (state.size === 0) {
            statusBar.hide();
            return;
        }
        
        const backIcon = state.canBack ? '$(arrow-left)' : '$(circle-slash)';
        const forwardIcon = state.canForward ? '$(arrow-right)' : '$(circle-slash)';
        
        statusBar.text = `${backIcon} ${state.index + 1}/${state.size} ${forwardIcon}`;
        statusBar.tooltip = `Navigation History: ${state.index + 1} of ${state.size}\nClick to show history`;
        statusBar.command = 'reqnroll-navigator.showHistory';
        statusBar.show();
    };
    
    history.onDidChangeHistory(updateStatusBar);
    updateStatusBar();
    
    return statusBar;
}
