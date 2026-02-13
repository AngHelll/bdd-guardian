/**
 * File Watchers
 * Watches for file changes and triggers incremental updates
 */

import * as vscode from 'vscode';
import { IndexManager } from './indexManager';
import { ExtensionConfig } from '../domain/types';
import { FILE_WATCHER_DEBOUNCE_MS } from '../domain/constants';

/**
 * Callback type for file watcher events
 */
export type FileWatcherCallback = () => void;

/**
 * File Watchers - Watches .feature and .cs files for changes
 */
export class FileWatchers implements vscode.Disposable {
    private featureWatcher: vscode.FileSystemWatcher | undefined;
    private bindingWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private indexManager: IndexManager,
        private config: ExtensionConfig,
        private onFeatureChange?: FileWatcherCallback,
        private onBindingChange?: FileWatcherCallback
    ) {}

    /**
     * Start file watchers
     */
    public start(): void {
        // Watch feature files
        this.featureWatcher = vscode.workspace.createFileSystemWatcher(this.config.featureGlob);
        
        this.disposables.push(
            this.featureWatcher.onDidCreate(uri => this.handleFeatureChange(uri, 'create')),
            this.featureWatcher.onDidChange(uri => this.handleFeatureChange(uri, 'change')),
            this.featureWatcher.onDidDelete(uri => this.handleFeatureDelete(uri))
        );

        // Watch C# files
        this.bindingWatcher = vscode.workspace.createFileSystemWatcher(this.config.bindingsGlob);
        
        this.disposables.push(
            this.bindingWatcher.onDidCreate(uri => this.handleBindingChange(uri, 'create')),
            this.bindingWatcher.onDidChange(uri => this.handleBindingChange(uri, 'change')),
            this.bindingWatcher.onDidDelete(uri => this.handleBindingDelete(uri))
        );

        this.disposables.push(this.featureWatcher, this.bindingWatcher);
    }

    /**
     * Handle feature file change (debounced)
     */
    private handleFeatureChange(uri: vscode.Uri, _type: 'create' | 'change'): void {
        this.debounce(`feature:${uri.toString()}`, async () => {
            await this.indexManager.indexFeatureFile(uri);
            this.onFeatureChange?.();
        });
    }

    /**
     * Handle feature file deletion
     */
    private handleFeatureDelete(uri: vscode.Uri): void {
        this.indexManager.removeFeatureFile(uri);
        this.onFeatureChange?.();
    }

    /**
     * Handle binding file change (debounced)
     */
    private handleBindingChange(uri: vscode.Uri, _type: 'create' | 'change'): void {
        this.debounce(`binding:${uri.toString()}`, async () => {
            await this.indexManager.indexBindingFile(uri, this.config.caseInsensitive);
            this.onBindingChange?.();
        });
    }

    /**
     * Handle binding file deletion
     */
    private handleBindingDelete(uri: vscode.Uri): void {
        this.indexManager.removeBindingFile(uri);
        this.onBindingChange?.();
    }

    /**
     * Debounce a callback
     */
    private debounce(key: string, callback: () => void): void {
        const existing = this.debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            callback();
        }, FILE_WATCHER_DEBOUNCE_MS);
        
        this.debounceTimers.set(key, timer);
    }

    /**
     * Update configuration
     */
    public updateConfig(config: ExtensionConfig): void {
        this.config = config;
    }

    /**
     * Dispose of watchers
     */
    public dispose(): void {
        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        
        // Dispose all subscriptions
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
