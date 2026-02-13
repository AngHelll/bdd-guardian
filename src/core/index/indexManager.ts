/**
 * Index Manager
 * Orchestrates indexing and incremental updates
 * 
 * Uses the multi-provider architecture to detect and index bindings
 * from different BDD frameworks automatically.
 * 
 * Enterprise Features (v0.3.0):
 * - Performance guardrails (max files limit, batch processing)
 * - Non-blocking UI (yields to event loop)
 * - Safe fallbacks with try/catch wrappers
 * - Cancellation token support
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

// ============================================================================
// Enterprise Constants
// ============================================================================

/** Default maximum files to index (performance guardrail) */
const DEFAULT_MAX_FILES = 5000;

/** Batch size for processing files (prevents UI blocking) */
const BATCH_SIZE = 50;

// ============================================================================
// Enterprise Utilities
// ============================================================================

/**
 * Yields to the UI event loop to prevent blocking
 * Critical for large workspace responsiveness
 */
async function yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

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
     * Perform full workspace indexing with enterprise guardrails
     */
    public async indexAll(
        config: ExtensionConfig, 
        token?: vscode.CancellationToken
    ): Promise<void> {
        if (this.indexing) {
            this.outputChannel.appendLine('[IndexManager] Indexing already in progress, skipping...');
            return;
        }

        this.indexing = true;
        const startTime = Date.now();
        const maxFiles = config.maxFilesIndexed ?? DEFAULT_MAX_FILES;

        try {
            this.outputChannel.appendLine('[IndexManager] Starting full workspace indexing...');
            this.outputChannel.appendLine(`[IndexManager] Max files limit: ${maxFiles}`);
            this.index.clear();

            // Check cancellation
            if (token?.isCancellationRequested) {
                this.outputChannel.appendLine('[IndexManager] Indexing cancelled by user');
                return;
            }

            // Step 1: Index feature files with batching
            await this.indexAllFeatures(config, maxFiles, token);

            // Check cancellation
            if (token?.isCancellationRequested) {
                this.outputChannel.appendLine('[IndexManager] Indexing cancelled by user');
                return;
            }

            // Step 2: Detect and select providers (with safe fallback)
            this.outputChannel.appendLine('[IndexManager] Detecting binding providers...');
            this.cachedProviderSelection = await this.safeDetectProviders();

            // Check cancellation
            if (token?.isCancellationRequested) {
                this.outputChannel.appendLine('[IndexManager] Indexing cancelled by user');
                return;
            }

            // Step 3: Index bindings using active providers
            await this.indexBindingsWithProviders(config, maxFiles, token);

            this.index.markIndexed();

            const duration = Date.now() - startTime;
            const stats = this.index.getStats();
            this.outputChannel.appendLine(
                `[IndexManager] Indexing complete in ${duration}ms: ` +
                `${stats.featureCount} features, ${stats.stepCount} steps, ${stats.bindingCount} bindings ` +
                `(${stats.providerCount} providers active)`
            );
        } catch (error) {
            this.outputChannel.appendLine(`[IndexManager] Indexing failed with error: ${error}`);
            // Don't rethrow - allow graceful degradation
        } finally {
            this.indexing = false;
        }
    }

    /**
     * Safe provider detection with fallback
     */
    private async safeDetectProviders(): Promise<ProviderSelection> {
        try {
            return await this.providerManager.detectProviders();
        } catch (error) {
            this.outputChannel.appendLine(`[IndexManager] Provider detection failed: ${error}`);
            // Return empty selection as safe fallback
            return {
                active: [],
                primary: null,
                report: [],
                detectedAt: new Date(),
            };
        }
    }

    /**
     * Index all feature files with batching and max limit
     */
    private async indexAllFeatures(
        config: ExtensionConfig, 
        maxFiles: number,
        token?: vscode.CancellationToken
    ): Promise<void> {
        const featureFiles = await vscode.workspace.findFiles(
            config.featureGlob,
            `{${config.excludePatterns.join(',')}}`
        );

        const totalFound = featureFiles.length;
        const filesToProcess = featureFiles.slice(0, maxFiles);
        
        if (totalFound > maxFiles) {
            this.outputChannel.appendLine(
                `[IndexManager] WARNING: Found ${totalFound} feature files, limiting to ${maxFiles}. ` +
                `Increase reqnrollNavigator.maxFilesIndexed to index more.`
            );
        }

        this.outputChannel.appendLine(`[IndexManager] Indexing ${filesToProcess.length} feature files`);

        // Process in batches with UI yields
        for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
            // Check cancellation at each batch
            if (token?.isCancellationRequested) {
                return;
            }

            const batch = filesToProcess.slice(i, i + BATCH_SIZE);
            
            for (const uri of batch) {
                await this.indexFeatureFile(uri);
            }

            // Yield to UI after each batch
            if (i + BATCH_SIZE < filesToProcess.length) {
                await yieldToUI();
            }
        }
    }

    /**
     * Index bindings using active providers with batching
     */
    private async indexBindingsWithProviders(
        config: ExtensionConfig,
        maxFiles: number,
        token?: vscode.CancellationToken
    ): Promise<void> {
        const selection = this.cachedProviderSelection;
        if (!selection || selection.active.length === 0) {
            // Fallback: no active providers, try primary
            if (selection?.primary) {
                await this.indexWithProvider(selection.primary, config, maxFiles, token);
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
            if (token?.isCancellationRequested) {
                return;
            }
            await this.indexWithProvider(provider, config, maxFiles, token);
        }
    }

    /**
     * Index bindings with a specific provider (with batching)
     */
    private async indexWithProvider(
        provider: IBindingProvider, 
        config: ExtensionConfig,
        maxFiles: number,
        token?: vscode.CancellationToken
    ): Promise<void> {
        try {
            this.outputChannel.appendLine(`[IndexManager] Indexing with ${provider.displayName}...`);

            // Find files matching provider's glob
            const allFiles = await vscode.workspace.findFiles(
                provider.bindingGlob,
                `{${config.excludePatterns.join(',')}}`
            );

            const files = allFiles.slice(0, maxFiles);
            
            if (allFiles.length > maxFiles) {
                this.outputChannel.appendLine(
                    `[IndexManager] WARNING: Found ${allFiles.length} binding files for ${provider.displayName}, ` +
                    `limiting to ${maxFiles}`
                );
            }

            this.outputChannel.appendLine(`[IndexManager] Found ${files.length} files for ${provider.displayName}`);

            // Process in batches for large file sets
            let allBindings: Awaited<ReturnType<typeof provider.indexBindings>> = [];
            
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                if (token?.isCancellationRequested) {
                    return;
                }

                const batch = files.slice(i, i + BATCH_SIZE);
                const bindings = await provider.indexBindings(batch, {
                    caseInsensitive: config.caseInsensitive,
                    debug: config.debug,
                });
                allBindings = allBindings.concat(bindings);

                // Yield to UI after each batch
                if (i + BATCH_SIZE < files.length) {
                    await yieldToUI();
                }
            }

            // Add to index with provider ID
            this.index.addBindings(allBindings, provider.id);

            this.outputChannel.appendLine(
                `[IndexManager] ${provider.displayName}: indexed ${allBindings.length} bindings`
            );
        } catch (error) {
            this.outputChannel.appendLine(
                `[IndexManager] Error indexing with ${provider.displayName}: ${error}`
            );
            // Don't rethrow - allow other providers to continue
        }
    }

    /**
     * Index a single feature file (with error handling)
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
            const selection = this.cachedProviderSelection ?? await this.safeDetectProviders();
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
        this.cachedProviderSelection = await this.safeDetectProviders();
        return this.cachedProviderSelection;
    }
}
