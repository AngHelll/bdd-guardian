/**
 * Domain Types
 * Core type definitions for the Reqnroll Navigator extension
 * 
 * These types are the stable contracts used throughout the codebase.
 * Changes to these types should be carefully considered as they
 * affect multiple modules.
 */

import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

/** Step keywords as written in feature files */
export type StepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';

/** Resolved step keywords (And/But resolved to actual keyword) */
export type ResolvedKeyword = 'Given' | 'When' | 'Then';

/** Tag filter mode */
export type TagFilterMode = 'include' | 'exclude';

/** Binding match status */
export type MatchStatus = 'bound' | 'unbound' | 'ambiguous';

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE DOCUMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a parsed .feature file
 */
export interface FeatureDocument {
    /** File URI */
    readonly uri: vscode.Uri;
    /** Feature name */
    readonly featureName: string;
    /** Tags applied at Feature level */
    readonly featureTags: readonly string[];
    /** Background steps (applied to all scenarios) */
    readonly backgroundSteps: readonly FeatureStep[];
    /** All scenarios in the feature */
    readonly scenarios: readonly Scenario[];
    /** All steps flattened for quick access */
    readonly allSteps: readonly FeatureStep[];
}

/**
 * Represents a Scenario or Scenario Outline
 */
export interface Scenario {
    /** 'Scenario' or 'Scenario Outline' */
    readonly type: 'Scenario' | 'Scenario Outline';
    /** Scenario name */
    readonly name: string;
    /** Tags directly on this scenario */
    readonly tags: readonly string[];
    /** Steps in this scenario */
    readonly steps: readonly FeatureStep[];
    /** Examples tables (only for Scenario Outline) */
    readonly examples: readonly ExampleTable[];
    /** Range in document */
    readonly range: vscode.Range;
}

/**
 * Represents an Examples table in a Scenario Outline
 */
export interface ExampleTable {
    /** Column headers (parameter names) */
    readonly headers: readonly string[];
    /** Data rows */
    readonly rows: readonly (readonly string[])[];
    /** Tags on the Examples block */
    readonly tags: readonly string[];
}

/**
 * Represents a single step in a feature file
 */
export interface FeatureStep {
    /** Original keyword (Given/When/Then/And/But) */
    readonly keywordOriginal: StepKeyword;
    /** Resolved keyword (And/But -> previous keyword) */
    readonly keywordResolved: ResolvedKeyword;
    /** Step text without keyword */
    readonly rawText: string;
    /** Normalized step text (whitespace normalized) */
    readonly normalizedText: string;
    /** Full line text including keyword */
    readonly fullText: string;
    /** Effective tags (feature + scenario tags) */
    readonly tagsEffective: readonly string[];
    /** File URI */
    readonly uri: vscode.Uri;
    /** Range in document */
    readonly range: vscode.Range;
    /** Line number (0-based) */
    readonly lineNumber: number;
    /** Parent scenario name */
    readonly scenarioName?: string;
    /** Whether this step is in a Scenario Outline */
    readonly isOutline: boolean;
    /** 
     * Candidate texts for matching (includes placeholder replacements)
     * First candidate is the fallback (<placeholder> -> X)
     */
    readonly candidateTexts: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// BINDING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a parsed C# binding file
 */
export interface BindingDocument {
    /** File URI */
    readonly uri: vscode.Uri;
    /** All bindings in this file */
    readonly bindings: readonly Binding[];
    /** Class names found in file */
    readonly classNames: readonly string[];
}

/**
 * Represents a single C# step binding
 */
export interface Binding {
    /** Keyword: Given, When, Then */
    readonly keyword: ResolvedKeyword;
    /** Raw pattern from attribute (unescaped) */
    readonly patternRaw: string;
    /** Compiled regex for matching */
    readonly regex: RegExp;
    /** Class name containing this binding */
    readonly className: string;
    /** Method name */
    readonly methodName: string;
    /** File URI */
    readonly uri: vscode.Uri;
    /** Range in document (attribute line) */
    readonly range: vscode.Range;
    /** Line number (0-based) */
    readonly lineNumber: number;
    /** Full signature: ClassName.MethodName */
    readonly signature: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCHING & RESOLUTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single match candidate with score
 */
export interface MatchCandidate {
    /** The matched binding */
    readonly binding: Binding;
    /** Match score (higher is better) */
    readonly score: number;
    /** Whether keyword matched exactly */
    readonly keywordMatched: boolean;
    /** The candidate text that matched */
    readonly matchedCandidate: string;
}

/**
 * Result of resolving a step to bindings
 */
export interface ResolveResult {
    /** The step that was resolved */
    readonly step: FeatureStep;
    /** Resolution status */
    readonly status: MatchStatus;
    /** Best match (if any) */
    readonly best?: MatchCandidate;
    /** All matching candidates (sorted by score descending) */
    readonly candidates: readonly MatchCandidate[];
    /** Debug information (only when debug enabled) */
    readonly debug?: ResolveDebugInfo;
}

/**
 * Debug information for resolution
 */
export interface ResolveDebugInfo {
    /** Original step text */
    readonly stepText: string;
    /** Number of candidate texts tried */
    readonly candidateTextCount: number;
    /** First few candidate texts (for logging) */
    readonly sampleCandidates: readonly string[];
    /** Number of bindings checked */
    readonly bindingsChecked: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extension configuration
 */
export interface ExtensionConfig {
    readonly caseInsensitive: boolean;
    readonly tagFilter: readonly string[];
    readonly tagFilterMode: TagFilterMode;
    readonly featureGlob: string;
    readonly bindingsGlob: string;
    readonly excludePatterns: readonly string[];
    readonly maxExampleRows: number;
    readonly enableCodeLens: boolean;
    readonly enableDiagnostics: boolean;
    readonly enableDecorations: boolean;
    readonly debug: boolean;
    readonly maxFilesIndexed?: number;
}

/**
 * Tag filter configuration (for filtering steps/scenarios)
 */
export interface TagFilterConfig {
    readonly tags: readonly string[];
    readonly mode: TagFilterMode;
}

// ═══════════════════════════════════════════════════════════════════════════
// INDEX TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * In-memory index of all features and bindings
 */
export interface WorkspaceIndexData {
    /** Map of URI string -> FeatureDocument */
    readonly features: ReadonlyMap<string, FeatureDocument>;
    /** Map of URI string -> BindingDocument */
    readonly bindingFiles: ReadonlyMap<string, BindingDocument>;
    /** All bindings flattened */
    readonly allBindings: readonly Binding[];
    /** Bindings grouped by keyword */
    readonly bindingsByKeyword: ReadonlyMap<ResolvedKeyword, readonly Binding[]>;
    /** Last index timestamp */
    readonly lastIndexed: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A diagnostic item for a step
 */
export interface StepDiagnostic {
    readonly step: FeatureStep;
    readonly status: MatchStatus;
    readonly message: string;
    readonly severity: vscode.DiagnosticSeverity;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Index change event types */
export type IndexChangeType = 'feature-added' | 'feature-updated' | 'feature-removed' |
                              'binding-added' | 'binding-updated' | 'binding-removed' |
                              'full-reindex';

/**
 * Event emitted when index changes
 */
export interface IndexChangeEvent {
    readonly type: IndexChangeType;
    readonly uri?: vscode.Uri;
    readonly timestamp: Date;
}
