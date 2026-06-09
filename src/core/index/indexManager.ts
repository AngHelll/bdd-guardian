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
import { getConfig } from '../../config';
import { 
    getProviderManager, 
    ProviderManager,
    IBindingProvider,
    ProviderSelection,
    DEFAULT_PROVIDER_CONFIG,
} from '../../providers/bindings';
import { resolveBindingSearchGlobs } from './bindingGlob';
import { formatIndexingModeLog, resolveProvidersToIndex } from './providerIndexing';

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

            // Step 2: Detect and select providers (fresh on each full index)
            this.outputChannel.appendLine('[IndexManager] Detecting binding providers...');
            this.providerManager.invalidateCache();
            this.cachedProviderSelection = await this.safeDetectProviders();
            this.logProviderDetectionSummary(this.cachedProviderSelection, config);

            // Check cancellation
            if (token?.isCancellationRequested) {
                this.outputChannel.appendLine('[IndexManager] Indexing cancelled by user');
                return;
            }

            // Step 3: Index bindings using selected providers (all active or primary only)
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

    private logProviderDetectionSummary(selection: ProviderSelection, config: ExtensionConfig): void {
        const threshold = DEFAULT_PROVIDER_CONFIG.activeThreshold;
        const thresholdPct = (threshold * 100).toFixed(0);
        const toIndex = resolveProvidersToIndex(selection, config.providerIndexMode);

        this.outputChannel.appendLine(
            `[IndexManager] Indexing mode: ${formatIndexingModeLog(config.providerIndexMode, toIndex)}`
        );
        this.outputChannel.appendLine(
            `[IndexManager] Provider detection (active threshold ${thresholdPct}%):`
        );

        const activeIds = new Set(selection.active.map((p) => p.id));

        for (const report of selection.report) {
            const pct = (report.confidence * 100).toFixed(0);
            const status = activeIds.has(report.id)
                ? 'ACTIVE'
                : report.confidence > 0
                  ? 'detected'
                  : 'inactive';
            const reason = report.reasons[0] ?? '—';
            this.outputChannel.appendLine(
                `  · ${report.displayName}: ${status} (${pct}%) — ${reason}`
            );
        }

        if (selection.active.length === 0) {
            this.logNoActiveProvidersHint();
        }

        if (config.providerIndexMode === 'primary' && !selection.primary) {
            this.outputChannel.appendLine(
                '[IndexManager] Primary indexing mode: no primary provider detected — no bindings indexed.'
            );
        }
    }

    private logNoActiveProvidersHint(): void {
        this.outputChannel.appendLine('[IndexManager] No active binding providers detected.');
        this.outputChannel.appendLine(
            '[IndexManager] Check go.mod (Godog), package.json (@cucumber/cucumber), or .csproj (Reqnroll/SpecFlow), then run "BDD Guardian: Reindex" or "Show Provider Detection Report".'
        );
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
        if (!selection) {
            this.logNoActiveProvidersHint();
            return;
        }

        const providers = resolveProvidersToIndex(selection, config.providerIndexMode);
        if (providers.length === 0) {
            this.logNoActiveProvidersHint();
            return;
        }

        this.outputChannel.appendLine(
            `[IndexManager] Indexing ${providers.length} provider(s): ` +
            providers.map((p) => p.displayName).join(', ')
        );

        for (const provider of providers) {
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

            const exclude = `{${config.excludePatterns.join(',')}}`;
            const allFiles = await this.findBindingFilesForProvider(provider, exclude);

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
     * Index a feature from an open or in-memory document (preferred while editing).
     */
    public indexFeatureDocument(document: vscode.TextDocument): boolean {
        try {
            const featureDoc = parseFeatureDocument(document);

            if (featureDoc) {
                this.index.setFeature(featureDoc);
                return true;
            }
            return false;
        } catch (error) {
            this.outputChannel.appendLine(
                `[IndexManager] Error indexing feature ${document.uri.fsPath}: ${error}`
            );
            return false;
        }
    }

    /**
     * Index a single feature file (with error handling).
     * Uses the unsaved buffer when the file is open in an editor.
     */
    public async indexFeatureFile(uri: vscode.Uri): Promise<boolean> {
        try {
            const openDoc = vscode.workspace.textDocuments.find(
                d => d.uri.toString() === uri.toString()
            );
            const document = openDoc ?? await vscode.workspace.openTextDocument(uri);
            return this.indexFeatureDocument(document);
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
            const provider = this.providerForBindingUri(uri, selection);

            if (!provider) {
                return false;
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const bindings = provider.parseFile(document, { caseInsensitive });

            if (bindings.length > 0) {
                this.index.removeBindingsForUri(uri);
                this.index.addBindings(bindings, provider.id);
                return true;
            }
            this.index.removeBindingsForUri(uri);
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
     * Glob patterns for binding file watchers (union of active providers).
     */
    public getBindingWatchPatterns(config: ExtensionConfig): string[] {
        const patterns = new Set<string>();
        const selection = this.cachedProviderSelection;

        if (selection) {
            const providers = resolveProvidersToIndex(selection, config.providerIndexMode);
            for (const provider of providers) {
                for (const glob of resolveBindingSearchGlobs(provider.bindingGlob)) {
                    patterns.add(glob);
                }
            }
        }

        if (patterns.size === 0) {
            patterns.add(config.bindingsGlob);
        }

        return [...patterns];
    }

    private async findBindingFilesForProvider(
        provider: IBindingProvider,
        exclude: string
    ): Promise<vscode.Uri[]> {
        const seen = new Set<string>();
        const merged: vscode.Uri[] = [];

        for (const glob of resolveBindingSearchGlobs(provider.bindingGlob)) {
            const files = await vscode.workspace.findFiles(glob, exclude);
            for (const uri of files) {
                const key = uri.fsPath;
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(uri);
                }
            }
        }

        return merged;
    }

    private providerForBindingUri(
        uri: vscode.Uri,
        selection: ProviderSelection
    ): IBindingProvider | null {
        const ext = uri.fsPath.includes('.')
            ? '.' + uri.fsPath.split('.').pop()!.toLowerCase()
            : '';

        const candidates = resolveProvidersToIndex(selection, getConfig().providerIndexMode);

        const byExt = candidates.find((p) => p.bindingFileExtensions.includes(ext));
        return byExt ?? candidates[0] ?? selection.primary;
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
