/**
 * Binding Provider Types
 * 
 * Defines the interfaces for multi-language binding provider architecture.
 * This enables automatic detection and support for different BDD frameworks.
 */

import * as vscode from 'vscode';
import { Binding } from '../../core/domain';

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER IDENTIFIERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Supported binding provider identifiers.
 * Each represents a specific BDD framework/language combination.
 */
export type BindingProviderId =
    | 'csharp-reqnroll'
    | 'csharp-specflow'
    | 'js-cucumber'
    | 'java-cucumber'
    | 'python-behave'
    | 'python-pytestbdd'
    | 'go-godog';

/**
 * Display information for each provider
 */
export const PROVIDER_INFO: Record<BindingProviderId, { displayName: string; languages: string[] }> = {
    'csharp-reqnroll': { displayName: 'C# Reqnroll', languages: ['csharp'] },
    'csharp-specflow': { displayName: 'C# SpecFlow', languages: ['csharp'] },
    'js-cucumber': { displayName: 'JavaScript Cucumber', languages: ['javascript', 'typescript'] },
    'java-cucumber': { displayName: 'Java Cucumber', languages: ['java'] },
    'python-behave': { displayName: 'Python Behave', languages: ['python'] },
    'python-pytestbdd': { displayName: 'Python pytest-bdd', languages: ['python'] },
    'go-godog': { displayName: 'Go Godog', languages: ['go'] },
};

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of provider detection for a workspace.
 */
export interface DetectionResult {
    /** Confidence score from 0.0 to 1.0 */
    readonly confidence: number;
    /** Human-readable reasons for the confidence score */
    readonly reasons: string[];
    /** Technical signals found (e.g., "found PackageReference Reqnroll") */
    readonly signals: string[];
    /** Primary languages detected */
    readonly primaryLanguages: string[];
}

/**
 * Factory for creating DetectionResult objects
 */
export function createDetectionResult(
    confidence: number,
    reasons: string[],
    signals: string[] = [],
    primaryLanguages: string[] = []
): DetectionResult {
    return {
        confidence: Math.min(1.0, Math.max(0.0, confidence)),
        reasons,
        signals,
        primaryLanguages,
    };
}

/**
 * Empty detection result (no confidence)
 */
export const EMPTY_DETECTION: DetectionResult = createDetectionResult(0, ['Not detected']);

/**
 * Not implemented detection result
 */
export const NOT_IMPLEMENTED_DETECTION: DetectionResult = createDetectionResult(
    0,
    ['Not implemented yet'],
    [],
    []
);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Binding Provider Interface
 * 
 * Each provider is responsible for:
 * 1. Detecting if the workspace uses its framework
 * 2. Indexing binding files and extracting step definitions
 */
export interface IBindingProvider {
    /** Unique provider identifier */
    readonly id: BindingProviderId;
    
    /** Human-readable display name */
    readonly displayName: string;
    
    /** Supported file extensions for bindings */
    readonly bindingFileExtensions: string[];
    
    /** Glob pattern to find binding files */
    readonly bindingGlob: string;
    
    /**
     * Detect if this provider's framework is used in the workspace.
     * Should be fast and lightweight (file search, not full parsing).
     * 
     * @param workspaceFolders - Workspace folders to scan
     * @returns Detection result with confidence and reasons
     */
    detect(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult>;
    
    /**
     * Index binding files and extract step definitions.
     * 
     * @param files - URIs of files to index
     * @param options - Indexing options
     * @returns Array of bindings found
     */
    indexBindings(
        files: readonly vscode.Uri[],
        options?: BindingIndexOptions
    ): Promise<Binding[]>;
    
    /**
     * Parse a single file for bindings.
     * Used for incremental updates.
     * 
     * @param document - Text document to parse
     * @param options - Indexing options
     * @returns Array of bindings found in this file
     */
    parseFile(
        document: vscode.TextDocument,
        options?: BindingIndexOptions
    ): Binding[];
}

/**
 * Options for binding indexing
 */
export interface BindingIndexOptions {
    /** Enable case-insensitive regex matching */
    caseInsensitive?: boolean;
    /** Enable debug logging */
    debug?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER SELECTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detection report for a single provider
 */
export interface ProviderDetectionReport {
    /** Provider ID */
    readonly id: BindingProviderId;
    /** Display name */
    readonly displayName: string;
    /** Confidence score */
    readonly confidence: number;
    /** Reasons for the score */
    readonly reasons: string[];
    /** Technical signals found */
    readonly signals: string[];
}

/**
 * Result of provider selection after detection
 */
export interface ProviderSelection {
    /** Active providers (confidence > threshold), sorted by confidence desc */
    readonly active: IBindingProvider[];
    /** Primary provider (highest confidence) or null if none */
    readonly primary: IBindingProvider | null;
    /** Detection report for all providers */
    readonly report: ProviderDetectionReport[];
    /** Timestamp of detection */
    readonly detectedAt: Date;
}

/**
 * Provider manager configuration
 */
export interface ProviderManagerConfig {
    /** Minimum confidence to consider a provider active */
    readonly activeThreshold: number;
    /** Enable debug logging */
    readonly debug: boolean;
}

/**
 * Default provider manager configuration
 */
export const DEFAULT_PROVIDER_CONFIG: ProviderManagerConfig = {
    activeThreshold: 0.3,
    debug: false,
};
