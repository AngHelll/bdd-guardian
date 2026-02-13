/**
 * Provider Manager
 * 
 * Manages binding provider detection, selection, and lifecycle.
 * Automatically detects which BDD frameworks are used in the workspace
 * and activates the appropriate providers.
 */

import * as vscode from 'vscode';
import {
    IBindingProvider,
    BindingProviderId,
    ProviderSelection,
    ProviderDetectionReport,
    ProviderManagerConfig,
    DEFAULT_PROVIDER_CONFIG,
    DetectionResult,
} from './types';

// Import all providers
import { getCSharpReqnrollProvider } from './csharpReqnrollProvider';
import { getCSharpSpecflowProvider } from './csharpSpecflowProvider';
import { getJsCucumberProvider } from './jsCucumberProvider';
import { getJavaCucumberProvider } from './javaCucumberProvider';
import { getPythonBehaveProvider } from './pythonBehaveProvider';
import { getPythonPytestBddProvider } from './pythonPytestBddProvider';
import { getGoGodogProvider } from './goGodogProvider';

/**
 * Provider Manager
 * 
 * Singleton that manages all binding providers and their detection/selection.
 */
export class ProviderManager {
    private providers: Map<BindingProviderId, IBindingProvider> = new Map();
    private cachedSelection: ProviderSelection | null = null;
    private config: ProviderManagerConfig;
    private outputChannel: vscode.OutputChannel | null = null;
    
    constructor(config: Partial<ProviderManagerConfig> = {}) {
        this.config = { ...DEFAULT_PROVIDER_CONFIG, ...config };
        this.registerAllProviders();
    }
    
    /**
     * Set output channel for debug logging.
     */
    setOutputChannel(channel: vscode.OutputChannel): void {
        this.outputChannel = channel;
    }
    
    /**
     * Register all available providers.
     */
    private registerAllProviders(): void {
        // C# providers
        this.registerProvider(getCSharpReqnrollProvider());
        this.registerProvider(getCSharpSpecflowProvider());
        
        // JavaScript/TypeScript
        this.registerProvider(getJsCucumberProvider());
        
        // Java
        this.registerProvider(getJavaCucumberProvider());
        
        // Python
        this.registerProvider(getPythonBehaveProvider());
        this.registerProvider(getPythonPytestBddProvider());
        
        // Go
        this.registerProvider(getGoGodogProvider());
    }
    
    /**
     * Register a single provider.
     */
    registerProvider(provider: IBindingProvider): void {
        this.providers.set(provider.id, provider);
    }
    
    /**
     * Get a provider by ID.
     */
    getProvider(id: BindingProviderId): IBindingProvider | undefined {
        return this.providers.get(id);
    }
    
    /**
     * Get all registered providers.
     */
    getAllProviders(): IBindingProvider[] {
        return Array.from(this.providers.values());
    }
    
    /**
     * Run detection for all providers and return selection.
     * Results are cached until invalidateCache() is called.
     */
    async detectProviders(): Promise<ProviderSelection> {
        if (this.cachedSelection) {
            return this.cachedSelection;
        }
        
        const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
        const report: ProviderDetectionReport[] = [];
        const detectionResults: Map<BindingProviderId, DetectionResult> = new Map();
        
        this.log('Starting provider detection...');
        const startTime = Date.now();
        
        // Run detection for all providers in parallel
        const detectionPromises = Array.from(this.providers.entries()).map(
            async ([id, provider]) => {
                try {
                    const result = await provider.detect(workspaceFolders);
                    detectionResults.set(id, result);
                    
                    report.push({
                        id,
                        displayName: provider.displayName,
                        confidence: result.confidence,
                        reasons: result.reasons,
                        signals: result.signals,
                    });
                    
                    this.log(`  ${provider.displayName}: confidence=${result.confidence.toFixed(2)}`);
                    if (result.signals.length > 0 && this.config.debug) {
                        result.signals.forEach(s => this.log(`    Signal: ${s}`));
                    }
                } catch (error) {
                    this.log(`  ${provider.displayName}: detection error - ${error}`);
                    report.push({
                        id,
                        displayName: provider.displayName,
                        confidence: 0,
                        reasons: [`Detection error: ${error}`],
                        signals: [],
                    });
                }
            }
        );
        
        await Promise.all(detectionPromises);
        
        // Sort report by confidence (descending)
        report.sort((a, b) => b.confidence - a.confidence);
        
        // Select active providers
        const activeProviders = report
            .filter(r => r.confidence >= this.config.activeThreshold)
            .map(r => this.providers.get(r.id)!)
            .filter(Boolean);
        
        // Determine primary provider
        const primary = report.length > 0 && report[0].confidence > 0
            ? this.providers.get(report[0].id) ?? null
            : null;
        
        const duration = Date.now() - startTime;
        this.log(`Provider detection complete in ${duration}ms`);
        this.log(`  Active providers: ${activeProviders.length > 0 ? activeProviders.map(p => p.displayName).join(', ') : 'none'}`);
        this.log(`  Primary: ${primary?.displayName ?? 'none'}`);
        
        this.cachedSelection = {
            active: activeProviders,
            primary,
            report,
            detectedAt: new Date(),
        };
        
        return this.cachedSelection;
    }
    
    /**
     * Get current selection (runs detection if not cached).
     */
    async selectActiveProviders(): Promise<ProviderSelection> {
        return this.detectProviders();
    }
    
    /**
     * Get cached selection without re-running detection.
     * Returns null if detection hasn't been run yet.
     */
    getCachedSelection(): ProviderSelection | null {
        return this.cachedSelection;
    }
    
    /**
     * Invalidate cached selection (force re-detection on next call).
     */
    invalidateCache(): void {
        this.cachedSelection = null;
        this.log('Provider cache invalidated');
    }
    
    /**
     * Update configuration.
     */
    updateConfig(config: Partial<ProviderManagerConfig>): void {
        this.config = { ...this.config, ...config };
        // Invalidate cache if threshold changed
        if ('activeThreshold' in config) {
            this.invalidateCache();
        }
    }
    
    /**
     * Get detection report as formatted string (for debug command).
     */
    getDetectionReportString(): string {
        const selection = this.cachedSelection;
        if (!selection) {
            return 'No detection has been run yet. Provider detection runs on extension activation.';
        }
        
        const lines: string[] = [
            '═══════════════════════════════════════════════════════════════',
            '  PROVIDER DETECTION REPORT',
            `  Detected at: ${selection.detectedAt.toISOString()}`,
            '═══════════════════════════════════════════════════════════════',
            '',
        ];
        
        for (const report of selection.report) {
            const status = report.confidence >= this.config.activeThreshold 
                ? '✓ ACTIVE' 
                : report.confidence > 0 
                    ? '○ DETECTED' 
                    : '✗ NOT DETECTED';
            
            lines.push(`${report.displayName} (${report.id})`);
            lines.push(`  Status: ${status}`);
            lines.push(`  Confidence: ${(report.confidence * 100).toFixed(0)}%`);
            lines.push(`  Reasons: ${report.reasons.join('; ')}`);
            if (report.signals.length > 0) {
                lines.push(`  Signals:`);
                report.signals.forEach(s => lines.push(`    - ${s}`));
            }
            lines.push('');
        }
        
        lines.push('───────────────────────────────────────────────────────────────');
        lines.push(`Active Providers: ${selection.active.length > 0 ? selection.active.map(p => p.displayName).join(', ') : 'None'}`);
        lines.push(`Primary Provider: ${selection.primary?.displayName ?? 'None'}`);
        lines.push(`Active Threshold: ${(this.config.activeThreshold * 100).toFixed(0)}%`);
        
        return lines.join('\n');
    }
    
    /**
     * Log message (if output channel is set).
     */
    private log(message: string): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[ProviderManager] ${message}`);
        }
    }
}

// Singleton instance
let instance: ProviderManager | null = null;

/**
 * Get the provider manager singleton.
 */
export function getProviderManager(config?: Partial<ProviderManagerConfig>): ProviderManager {
    if (!instance) {
        instance = new ProviderManager(config);
    } else if (config) {
        instance.updateConfig(config);
    }
    return instance;
}

/**
 * Reset the provider manager (for testing).
 */
export function resetProviderManager(): void {
    instance = null;
}
