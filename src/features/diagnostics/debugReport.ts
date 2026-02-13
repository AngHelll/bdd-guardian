/**
 * Debug Report Generator
 * Generates a comprehensive debug report for troubleshooting.
 */

import * as vscode from 'vscode';
import { WorkspaceIndex } from '../../core/index';
import { ProviderManager } from '../../providers/bindings/providerManager';

// Extension version - imported from package.json at build time
const EXTENSION_VERSION = '0.3.0';

export interface DebugReport {
    timestamp: string;
    extension: {
        name: string;
        version: string;
        environment: string;
    };
    workspace: {
        name: string;
        folders: string[];
        rootPath: string | undefined;
    };
    index: {
        featureCount: number;
        stepCount: number;
        bindingCount: number;
        bindingsByKeyword: {
            Given: number;
            When: number;
            Then: number;
        };
        bindingsByProvider: Record<string, number>;
    };
    providers: {
        detected: string[];
        active: string[];
        selection: {
            isAutoDetected: boolean;
            detectedAt: string;
        } | null;
    };
    performance: {
        lastIndexDurationMs: number | null;
        averageResolveDurationMs: number | null;
    };
    vscode: {
        version: string;
        language: string;
        shell: string;
    };
}

// Performance tracking
let lastIndexDuration: number | null = null;
let resolveTimings: number[] = [];
const MAX_RESOLVE_TIMINGS = 100;

/**
 * Record indexing duration
 */
export function recordIndexDuration(durationMs: number): void {
    lastIndexDuration = durationMs;
}

/**
 * Record resolve duration
 */
export function recordResolveDuration(durationMs: number): void {
    resolveTimings.push(durationMs);
    if (resolveTimings.length > MAX_RESOLVE_TIMINGS) {
        resolveTimings = resolveTimings.slice(-MAX_RESOLVE_TIMINGS);
    }
}

/**
 * Get average resolve duration
 */
function getAverageResolveDuration(): number | null {
    if (resolveTimings.length === 0) return null;
    const sum = resolveTimings.reduce((a, b) => a + b, 0);
    return Math.round((sum / resolveTimings.length) * 100) / 100;
}

/**
 * Generate a debug report
 */
export function generateDebugReport(
    workspaceIndex: WorkspaceIndex,
    providerManager: ProviderManager
): DebugReport {
    const stats = workspaceIndex.getStats();
    const bindings = workspaceIndex.getAllBindings();
    
    // Count bindings by keyword
    const bindingsByKeyword = { Given: 0, When: 0, Then: 0 };
    bindings.forEach(b => {
        if (b.keyword in bindingsByKeyword) {
            bindingsByKeyword[b.keyword as keyof typeof bindingsByKeyword]++;
        }
    });
    
    // Count bindings by provider
    const bindingCountByProvider = workspaceIndex.getBindingCountByProvider();
    const bindingsByProvider: Record<string, number> = {};
    bindingCountByProvider.forEach((count, providerId) => {
        bindingsByProvider[providerId] = count;
    });
    
    // Get provider info
    const detectionReport = providerManager.getCachedSelection()?.report || [];
    const selection = providerManager.getCachedSelection();
    
    // Get workspace info
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    
    return {
        timestamp: new Date().toISOString(),
        extension: {
            name: 'BDD Guardian',
            version: EXTENSION_VERSION,
            environment: vscode.env.appName,
        },
        workspace: {
            name: vscode.workspace.name || 'Unnamed',
            folders: workspaceFolders.map(f => f.uri.fsPath),
            rootPath: workspaceFolders[0]?.uri.fsPath,
        },
        index: {
            featureCount: stats.featureCount,
            stepCount: stats.stepCount,
            bindingCount: stats.bindingCount,
            bindingsByKeyword,
            bindingsByProvider,
        },
        providers: {
            detected: detectionReport.map(r => r.displayName),
            active: selection?.active.map(p => p.displayName) || [],
            selection: selection ? {
                isAutoDetected: true,
                detectedAt: selection.detectedAt.toISOString(),
            } : null,
        },
        performance: {
            lastIndexDurationMs: lastIndexDuration,
            averageResolveDurationMs: getAverageResolveDuration(),
        },
        vscode: {
            version: vscode.version,
            language: vscode.env.language,
            shell: vscode.env.shell,
        },
    };
}

/**
 * Copy debug report to clipboard as JSON
 */
export async function copyDebugReportToClipboard(
    workspaceIndex: WorkspaceIndex,
    providerManager: ProviderManager
): Promise<void> {
    const report = generateDebugReport(workspaceIndex, providerManager);
    const json = JSON.stringify(report, null, 2);
    
    await vscode.env.clipboard.writeText(json);
    
    vscode.window.showInformationMessage(
        `Debug report copied to clipboard (${report.index.bindingCount} bindings, ${report.index.stepCount} steps)`
    );
}
