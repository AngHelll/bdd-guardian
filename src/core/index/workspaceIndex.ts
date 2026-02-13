/**
 * Workspace Index
 * In-memory store for all indexed features and bindings
 * Provides query helpers for efficient lookups
 * 
 * Supports multi-provider architecture: bindings are stored grouped by provider.
 */

import * as vscode from 'vscode';
import {
    FeatureDocument,
    FeatureStep,
    BindingDocument,
    Binding,
    ResolvedKeyword,
    WorkspaceIndexData,
    IndexChangeEvent,
    IndexChangeType,
} from '../domain/types';

/** Provider ID type (imported from providers module to avoid circular deps) */
export type ProviderId = string;

/**
 * Event emitter for index changes
 */
type IndexChangeListener = (event: IndexChangeEvent) => void;

/**
 * Workspace Index - Central store for all indexed data
 */
export class WorkspaceIndex {
    private features: Map<string, FeatureDocument> = new Map();
    private bindingFiles: Map<string, BindingDocument> = new Map();
    private allBindings: Binding[] = [];
    private bindingsByKeyword: Map<ResolvedKeyword, Binding[]> = new Map([
        ['Given', []],
        ['When', []],
        ['Then', []],
    ]);
    
    // Multi-provider support
    private bindingsByProvider: Map<ProviderId, Binding[]> = new Map();
    private activeProviders: Set<ProviderId> = new Set();
    
    private lastIndexed: Date = new Date(0);
    private listeners: IndexChangeListener[] = [];

    // ═══════════════════════════════════════════════════════════════════════
    // QUERY METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get a snapshot of the current index data
     */
    public getData(): WorkspaceIndexData {
        return {
            features: new Map(this.features),
            bindingFiles: new Map(this.bindingFiles),
            allBindings: [...this.allBindings],
            bindingsByKeyword: new Map(this.bindingsByKeyword),
            lastIndexed: this.lastIndexed,
        };
    }

    /**
     * Get feature document by URI
     */
    public getFeatureByUri(uri: vscode.Uri): FeatureDocument | undefined {
        return this.features.get(uri.toString());
    }

    /**
     * Get all steps for a URI
     */
    public getStepsForUri(uri: vscode.Uri): readonly FeatureStep[] {
        const feature = this.features.get(uri.toString());
        return feature?.allSteps ?? [];
    }

    /**
     * Get step at a specific position
     */
    public getStepAtPosition(uri: vscode.Uri, position: vscode.Position): FeatureStep | undefined {
        const feature = this.features.get(uri.toString());
        if (!feature) return undefined;
        
        return feature.allSteps.find(step => step.lineNumber === position.line);
    }

    /**
     * Get all bindings
     */
    public getAllBindings(): readonly Binding[] {
        return this.allBindings;
    }

    /**
     * Get bindings by keyword
     */
    public getBindingsByKeyword(keyword: ResolvedKeyword): readonly Binding[] {
        return this.bindingsByKeyword.get(keyword) ?? [];
    }

    /**
     * Get binding document by URI
     */
    public getBindingFileByUri(uri: vscode.Uri): BindingDocument | undefined {
        return this.bindingFiles.get(uri.toString());
    }

    /**
     * Get all feature documents
     */
    public getAllFeatures(): readonly FeatureDocument[] {
        return Array.from(this.features.values());
    }

    /**
     * Get all feature URIs
     */
    public getFeatureUris(): readonly vscode.Uri[] {
        return Array.from(this.features.values()).map(f => f.uri);
    }

    /**
     * Get statistics
     */
    public getStats(): { featureCount: number; stepCount: number; bindingCount: number; providerCount: number } {
        let stepCount = 0;
        for (const feature of this.features.values()) {
            stepCount += feature.allSteps.length;
        }
        return {
            featureCount: this.features.size,
            stepCount,
            bindingCount: this.allBindings.length,
            providerCount: this.activeProviders.size,
        };
    }

    /**
     * Get bindings for a specific provider
     */
    public getBindingsByProvider(providerId: ProviderId): readonly Binding[] {
        return this.bindingsByProvider.get(providerId) ?? [];
    }

    /**
     * Get all active provider IDs
     */
    public getActiveProviderIds(): readonly ProviderId[] {
        return Array.from(this.activeProviders);
    }

    /**
     * Get binding count per provider
     */
    public getBindingCountByProvider(): Map<ProviderId, number> {
        const counts = new Map<ProviderId, number>();
        for (const [providerId, bindings] of this.bindingsByProvider) {
            counts.set(providerId, bindings.length);
        }
        return counts;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MUTATION METHODS (used by IndexManager)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Add or update a feature document
     */
    public setFeature(feature: FeatureDocument): void {
        const uriStr = feature.uri.toString();
        const isUpdate = this.features.has(uriStr);
        this.features.set(uriStr, feature);
        this.emitChange(isUpdate ? 'feature-updated' : 'feature-added', feature.uri);
    }

    /**
     * Remove a feature document
     */
    public removeFeature(uri: vscode.Uri): boolean {
        const removed = this.features.delete(uri.toString());
        if (removed) {
            this.emitChange('feature-removed', uri);
        }
        return removed;
    }

    /**
     * Add or update a binding document
     */
    public setBindingFile(bindingDoc: BindingDocument, providerId?: ProviderId): void {
        const uriStr = bindingDoc.uri.toString();
        const isUpdate = this.bindingFiles.has(uriStr);
        
        // Remove old bindings from this file first
        this.removeBindingsFromFile(bindingDoc.uri);
        
        // Add new bindings
        this.bindingFiles.set(uriStr, bindingDoc);
        
        for (const binding of bindingDoc.bindings) {
            this.allBindings.push(binding);
            const keywordBindings = this.bindingsByKeyword.get(binding.keyword);
            if (keywordBindings) {
                keywordBindings.push(binding);
            }
            
            // Track by provider
            if (providerId) {
                if (!this.bindingsByProvider.has(providerId)) {
                    this.bindingsByProvider.set(providerId, []);
                }
                this.bindingsByProvider.get(providerId)!.push(binding);
                this.activeProviders.add(providerId);
            }
        }
        
        this.emitChange(isUpdate ? 'binding-updated' : 'binding-added', bindingDoc.uri);
    }

    /**
     * Add bindings directly (without BindingDocument wrapper)
     */
    public addBindings(bindings: Binding[], providerId: ProviderId): void {
        if (!this.bindingsByProvider.has(providerId)) {
            this.bindingsByProvider.set(providerId, []);
        }
        
        for (const binding of bindings) {
            this.allBindings.push(binding);
            
            const keywordBindings = this.bindingsByKeyword.get(binding.keyword);
            if (keywordBindings) {
                keywordBindings.push(binding);
            }
            
            this.bindingsByProvider.get(providerId)!.push(binding);
        }
        
        if (bindings.length > 0) {
            this.activeProviders.add(providerId);
            this.emitChange('binding-added');
        }
    }

    /**
     * Clear bindings for a specific provider
     */
    public clearProviderBindings(providerId: ProviderId): void {
        const providerBindings = this.bindingsByProvider.get(providerId);
        if (!providerBindings || providerBindings.length === 0) {
            return;
        }
        
        const providerUris = new Set(providerBindings.map(b => b.uri.toString()));
        
        // Remove from allBindings
        this.allBindings = this.allBindings.filter(b => !providerUris.has(b.uri.toString()));
        
        // Remove from byKeyword maps
        for (const keyword of ['Given', 'When', 'Then'] as ResolvedKeyword[]) {
            const bindings = this.bindingsByKeyword.get(keyword);
            if (bindings) {
                this.bindingsByKeyword.set(
                    keyword,
                    bindings.filter(b => !providerUris.has(b.uri.toString()))
                );
            }
        }
        
        // Clear provider map
        this.bindingsByProvider.set(providerId, []);
        this.activeProviders.delete(providerId);
        
        this.emitChange('binding-removed');
    }

    /**
     * Remove a binding document
     */
    public removeBindingFile(uri: vscode.Uri): boolean {
        const removed = this.bindingFiles.delete(uri.toString());
        if (removed) {
            this.removeBindingsFromFile(uri);
            this.emitChange('binding-removed', uri);
        }
        return removed;
    }

    /**
     * Clear all data
     */
    public clear(): void {
        this.features.clear();
        this.bindingFiles.clear();
        this.allBindings = [];
        this.bindingsByKeyword = new Map([
            ['Given', []],
            ['When', []],
            ['Then', []],
        ]);
        this.bindingsByProvider.clear();
        this.activeProviders.clear();
        this.emitChange('full-reindex');
    }

    /**
     * Mark indexing complete
     */
    public markIndexed(): void {
        this.lastIndexed = new Date();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EVENT METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Subscribe to index changes
     */
    public onDidChange(listener: IndexChangeListener): vscode.Disposable {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const idx = this.listeners.indexOf(listener);
                if (idx >= 0) {
                    this.listeners.splice(idx, 1);
                }
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    private removeBindingsFromFile(uri: vscode.Uri): void {
        const uriStr = uri.toString();
        
        // Remove from allBindings
        this.allBindings = this.allBindings.filter(b => b.uri.toString() !== uriStr);
        
        // Remove from byKeyword maps
        for (const keyword of ['Given', 'When', 'Then'] as ResolvedKeyword[]) {
            const bindings = this.bindingsByKeyword.get(keyword);
            if (bindings) {
                this.bindingsByKeyword.set(
                    keyword,
                    bindings.filter(b => b.uri.toString() !== uriStr)
                );
            }
        }
    }

    private emitChange(type: IndexChangeType, uri?: vscode.Uri): void {
        const event: IndexChangeEvent = {
            type,
            uri,
            timestamp: new Date(),
        };
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (e) {
                console.error('[WorkspaceIndex] Error in change listener:', e);
            }
        }
    }
}
