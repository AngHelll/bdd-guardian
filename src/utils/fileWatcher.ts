/**
 * File Watcher
 * Watches for changes to feature and binding files
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';
import { BindingIndexer } from '../indexers/bindingIndexer';
import { getConfig } from '../types';

export class FileWatcher {
    private featureWatcher: vscode.FileSystemWatcher | undefined;
    private bindingWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private featureIndexer: FeatureIndexer,
        private bindingIndexer: BindingIndexer,
        private onFeatureChange: () => void,
        private onBindingChange: () => void
    ) {}

    /**
     * Start watching files
     */
    public start(): void {
        const config = getConfig();

        // Watch feature files
        this.featureWatcher = vscode.workspace.createFileSystemWatcher(config.featureGlob);
        
        this.featureWatcher.onDidCreate(async (uri) => {
            console.log(`[Reqnroll Navigator] Feature file created: ${uri.fsPath}`);
            await this.featureIndexer.indexFile(uri);
            this.onFeatureChange();
        });

        this.featureWatcher.onDidChange(async (uri) => {
            console.log(`[Reqnroll Navigator] Feature file changed: ${uri.fsPath}`);
            await this.featureIndexer.indexFile(uri);
            this.onFeatureChange();
        });

        this.featureWatcher.onDidDelete((uri) => {
            console.log(`[Reqnroll Navigator] Feature file deleted: ${uri.fsPath}`);
            this.featureIndexer.removeFile(uri);
            this.onFeatureChange();
        });

        this.disposables.push(this.featureWatcher);

        // Watch C# binding files
        this.bindingWatcher = vscode.workspace.createFileSystemWatcher(config.bindingsGlob);

        this.bindingWatcher.onDidCreate(async (uri) => {
            console.log(`[Reqnroll Navigator] Binding file created: ${uri.fsPath}`);
            await this.bindingIndexer.indexFile(uri);
            this.onBindingChange();
        });

        this.bindingWatcher.onDidChange(async (uri) => {
            console.log(`[Reqnroll Navigator] Binding file changed: ${uri.fsPath}`);
            await this.bindingIndexer.indexFile(uri);
            this.onBindingChange();
        });

        this.bindingWatcher.onDidDelete((uri) => {
            console.log(`[Reqnroll Navigator] Binding file deleted: ${uri.fsPath}`);
            this.bindingIndexer.removeFile(uri);
            this.onBindingChange();
        });

        this.disposables.push(this.bindingWatcher);

        console.log('[Reqnroll Navigator] File watchers started');
    }

    /**
     * Stop watching files
     */
    public stop(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.featureWatcher = undefined;
        this.bindingWatcher = undefined;
        console.log('[Reqnroll Navigator] File watchers stopped');
    }

    /**
     * Dispose watchers
     */
    public dispose(): void {
        this.stop();
    }
}
