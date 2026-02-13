/**
 * Index Manager
 * Orchestrates indexing and incremental updates
 * 
 * Uses the multi-provider architecture to detect and index bindings
 * from different BDD frameworks automatically.
 */

import * as vscode from 'vscode';
import { WorkspaceIndex } from './workspaceIndex';
import { parseFeatureDocument } from '../parsing/gherkinParser';
import { ExtensionConfig } from '../domain/types';
import { 
    getProviderManager, 
    ProviderManager,
    IBindingProvider,
    ProviderSelection,
} from '../../providers/bindings';

/**
 * Index Manager - Orchestrates indexing operations
 */
export class IndexManager {
    private indexing = false;
    private providerManager: ProviderManager;
    private cachedProviderSelection: ProviderSelection | null = null;

    constructor(
        private index: WorkspaceIndex,
        private outputChannel: vscode.OutputChannel
    ) {
        this.providerManager = getProviderManager();
        this.providerManager.setOutputChannel(outputChannel);
    }

    /**
     * Perform full workspace indexing
     */
    public async indexAll(config: ExtensionConfig): Promise<void> {
        if (this.indexing) {
            this.outputChannel.appendLine('[IndexManager] Indexing already in progress, skipping...');
            return;
        }

        this.indexing = true;
        const startTime = Date.now();

        try {
            this.outputChannel.appendLine('[IndexManager] Starting full workspace indexing...');
            this.index.clear();

            // Step 1: Index feature files
            await this.indexAllFeatures(config);

            // Step 2: Detect and select providers
            this.outputChannel.appendLine('[IndexManager] Detecting binding providers...');
            this.cachedProviderSelection = await this.providerManager.detectProviders();

            // Step 3: Index bindings using active providers
            await this.indexBindingsWithProviders(config);

            this.index.markIndexed();

            const duration = Date.now() - startTime;
            const stats = this.index.getStats();
            this.outputChannel.appendLine(
                `[IndexManager] Indexing complete in ${duration}ms: ` +
                `${stats.featureCount} features, ${stats.stepCount} steps, ${stats.bindingCount} bindings ` +
                `(${stats.providerCount} providers active)`
            );
        } finally {
            this.indexing = false;
        }
    }

    /**
     * Index all feature files
     */
    private async indexAllFeatures(config: ExtensionConfig): Promise<void> {
        const featureFiles = await vscode.workspace.findFiles(
            config.featureGlob,
            `{${config.excludePatterns.join(',')}}`
        );

        this.outputChannel.appendLine(`[IndexManager] Found ${featureFiles.length} feature files`);

        for (const uri of featureFiles) {
            await this.indexFeatureFile(uri);
        }
    }

    /**
     * Index bindings using active providers
     */
    private async indexBindingsWithProviders(config: ExtensionConfig): Promise<void> {
        const selection = this.cachedProviderSelection;
        if (!selection || selection.active.length === 0) {
            // Fallback: no active providers, try primary
            if (selection?.primary) {
                await this.indexWithProvider(selection.primary, config);
            } else {
                this.outputChannel.appendLine('[IndexManager] No active binding providers detected');
            }
            return;
        }

        this.outputChannel.appendLine(
            `[IndexManager] Using ${selection.active.length} active provider(s): ` +
            selection.active.map(p => p.displayName).join(', ')
        );

        // Index with each active provider
        for (const provider of selection.active) {
            await this.indexWithProvider(provider, config);
        }
    }

    /**
     * Index bindings with a specific provider
     */
    private async indexWithProvider(provider: IBindingProvider, config: ExtensionConfig): Promise<void> {
        try {
            this.outputChannel.appendLine(`[IndexManager] Indexing with ${provider.displayName}...`);
            
            // Find files matching provider's glob
            const files = await vscode.workspace.findFiles(
                provider.bindingGlob,
                `{${config.excludePatterns.join(',')}}`
            );

            this.outputChannel.appendLine(`[IndexManager] Found ${files.length} files for ${provider.displayName}`);

            // Index bindings
            const bindings = await provider.indexBindings(files, {
                caseInsensitive: config.caseInsensitive,
                debug: config.debug,
            });

            // Add to index with provider ID
            this.index.addBindings(bindings, provider.id);

            this.outputChannel.appendLine(
                `[IndexManager] ${provider.displayName}: indexed ${bindings.length} bindings`
            );
        } catch (error) {
            this.outputChannel.appendLine(
                `[IndexManager] Error indexing with ${provider.displayName}: ${error}`
            );
        }
    }

    /**
     * Index a single feature file
     */
    public async indexFeatureFile(uri: vscode.Uri): Promise<boolean> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const featureDoc = parseFeatureDocument(document);
            
            if (featureDoc) {
                this.index.setFeature(featureDoc);
                return true;
            }
            return false;
        } catch (error) {
            this.outputChannel.appendLine(`[IndexManager] Error indexing feature ${uri.fsPath}: ${error}`);
            return false;
        }
    }

    /**
     * Index a single binding file (uses primary provider)
     */
    public async indexBindingFile(uri: vscode.Uri, caseInsensitive: boolean = false): Promise<boolean> {
        try {
            const selection = this.cachedProviderSelection ?? await this.providerManager.detectProviders();
            const provider = selection.primary;
            
            if (!provider) {
                return false;
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const bindings = provider.parseFile(document, { caseInsensitive });
            
            if (bindings.length > 0) {
                // Clear old bindings from this file first
                this.index.removeBindingFile(uri);
                this.index.addBindings(bindings, provider.id);
                return true;
            }
            return false;
        } catch (error) {
            this.outputChannel.appendLine(`[IndexManager] Error indexing binding ${uri.fsPath}: ${error}`);
            return false;
        }
    }

    /**
     * Remove a feature file from index
     */
    public removeFeatureFile(uri: vscode.Uri): void {
        this.index.removeFeature(uri);
    }

    /**
     * Remove a binding file from index
     */
    public removeBindingFile(uri: vscode.Uri): void {
        this.index.removeBindingFile(uri);
    }

    /**
     * Check if indexing is in progress
     */
    public isIndexing(): boolean {
        return this.indexing;
    }

    /**
     * Get the underlying workspace index
     */
    public getIndex(): WorkspaceIndex {
        return this.index;
    }

    /**
     * Get the provider manager
     */
    public getProviderManager(): ProviderManager {
        return this.providerManager;
    }

    /**
     * Get cached provider selection
     */
    public getProviderSelection(): ProviderSelection | null {
        return this.cachedProviderSelection;
    }

    /**
     * Force re-detection of providers
     */
    public async redetectProviders(): Promise<ProviderSelection> {
        this.providerManager.invalidateCache();
        this.cachedProviderSelection = await this.providerManager.detectProviders();
        return this.cachedProviderSelection;
    }
}
