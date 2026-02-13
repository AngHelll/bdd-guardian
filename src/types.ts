/**
 * Reqnroll Navigator - Type Definitions
 * Core types for feature steps, bindings, and matching results
 */

import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type StepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';
export type ResolvedKeyword = 'Given' | 'When' | 'Then';

export interface FeatureStep {
    /** Original keyword from the feature file (Given/When/Then/And/But) */
    keywordOriginal: StepKeyword;
    /** Resolved keyword (And/But resolved to previous concrete keyword) */
    keywordResolved: ResolvedKeyword;
    /** Step text without the keyword */
    stepText: string;
    /** Full line text including keyword */
    fullText: string;
    /** Tags in scope (from scenario + feature) */
    tagsInScope: string[];
    /** File URI */
    uri: vscode.Uri;
    /** Range in the document */
    range: vscode.Range;
    /** Line number (0-based) */
    lineNumber: number;
    /** Parent scenario/outline name */
    scenarioName?: string;
    /** If part of Scenario Outline, reference to examples */
    examples?: ExampleTable[];
}

export interface ExampleTable {
    /** Header row (column names) */
    headers: string[];
    /** Data rows */
    rows: string[][];
    /** Tags on the Examples block */
    tags: string[];
}

export interface ScenarioBlock {
    /** Scenario or Scenario Outline */
    type: 'Scenario' | 'Scenario Outline';
    /** Scenario name */
    name: string;
    /** Tags directly on this scenario */
    tags: string[];
    /** Steps in this scenario */
    steps: FeatureStep[];
    /** Examples (only for Scenario Outline) */
    examples: ExampleTable[];
    /** Range in document */
    range: vscode.Range;
}

export interface FeatureFile {
    /** File URI */
    uri: vscode.Uri;
    /** Feature name */
    featureName: string;
    /** Feature-level tags */
    featureTags: string[];
    /** Background steps */
    backgroundSteps: FeatureStep[];
    /** All scenarios */
    scenarios: ScenarioBlock[];
    /** All steps (flattened for quick access) */
    allSteps: FeatureStep[];
}

// ═══════════════════════════════════════════════════════════════════════════
// BINDING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface StepBinding {
    /** Keyword: Given, When, Then */
    keyword: ResolvedKeyword;
    /** Raw pattern from attribute */
    patternRaw: string;
    /** Compiled regex for matching */
    regex: RegExp;
    /** Class name containing the binding */
    className: string;
    /** Method name */
    methodName: string;
    /** File URI */
    uri: vscode.Uri;
    /** Range of the attribute in the document */
    range: vscode.Range;
    /** Line number (0-based) */
    lineNumber: number;
    /** Full method signature for display */
    methodSignature?: string;
}

export interface BindingFile {
    /** File URI */
    uri: vscode.Uri;
    /** All bindings in this file */
    bindings: StepBinding[];
    /** Class names found */
    classNames: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCHING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MatchResult {
    /** The matched binding */
    binding: StepBinding;
    /** Match score (higher is better) */
    score: number;
    /** Whether keyword was matched exactly */
    keywordMatched: boolean;
    /** Which candidate string matched */
    matchedCandidate?: string;
}

export type MatchStatus = 'bound' | 'unbound' | 'ambiguous';

export interface StepMatchResult {
    /** The feature step */
    step: FeatureStep;
    /** Match status */
    status: MatchStatus;
    /** All matches (empty if unbound, 1 if bound, >1 if ambiguous) */
    matches: MatchResult[];
    /** Best match (if any) */
    bestMatch?: MatchResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// INDEX TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureIndex {
    /** All indexed feature files */
    features: Map<string, FeatureFile>;
    /** Last index time */
    lastIndexed: Date;
}

export interface BindingIndex {
    /** All indexed binding files */
    files: Map<string, BindingFile>;
    /** All bindings (flattened) */
    allBindings: StepBinding[];
    /** Bindings by keyword for quick lookup */
    byKeyword: Map<ResolvedKeyword, StepBinding[]>;
    /** Last index time */
    lastIndexed: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type TagFilterMode = 'include' | 'exclude';

export interface TagFilterConfig {
    /** Tags to filter by */
    tags: string[];
    /** Filter mode: include or exclude */
    mode: TagFilterMode;
}

export interface ReqnrollNavigatorConfig {
    caseInsensitive: boolean;
    tagFilter: string[];
    tagFilterMode: TagFilterMode;
    featureGlob: string;
    bindingsGlob: string;
    excludePatterns: string[];
    maxExampleRows: number;
    enableCodeLens: boolean;
    enableDiagnostics: boolean;
    debug: boolean;
}

export function getConfig(): ReqnrollNavigatorConfig {
    const config = vscode.workspace.getConfiguration('reqnrollNavigator');
    return {
        caseInsensitive: config.get('caseInsensitive', false),
        tagFilter: config.get('tagFilter', []),
        tagFilterMode: config.get('tagFilterMode', 'include'),
        featureGlob: config.get('featureGlob', '**/*.feature'),
        bindingsGlob: config.get('bindingsGlob', '**/*.cs'),
        excludePatterns: config.get('excludePatterns', ['**/bin/**', '**/obj/**', '**/node_modules/**']),
        maxExampleRows: config.get('maxExampleRows', 20),
        enableCodeLens: config.get('enableCodeLens', true),
        enableDiagnostics: config.get('enableDiagnostics', true),
        debug: config.get('debug', false),
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// TAG FILTERING HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines if a step should be shown based on tag filter configuration.
 * This affects ONLY CodeLens and Diagnostics - NOT navigation.
 * 
 * @param step The feature step to check
 * @param filterConfig The tag filter configuration
 * @returns true if the step should be shown, false otherwise
 */
export function shouldShowStep(step: FeatureStep, filterConfig: TagFilterConfig): boolean {
    // If no filter tags, show everything
    if (!filterConfig.tags || filterConfig.tags.length === 0) {
        return true;
    }

    // Check if step has any matching tag (case-insensitive)
    const stepTagsLower = step.tagsInScope.map(t => t.toLowerCase());
    const filterTagsLower = filterConfig.tags.map(t => t.toLowerCase());
    
    const hasMatchingTag = filterTagsLower.some(filterTag => 
        stepTagsLower.includes(filterTag)
    );

    // Apply filter mode
    if (filterConfig.mode === 'include') {
        // Include mode: only show steps with matching tags
        return hasMatchingTag;
    } else {
        // Exclude mode: hide steps with matching tags
        return !hasMatchingTag;
    }
}

/**
 * Get tag filter configuration from settings
 */
export function getTagFilterConfig(): TagFilterConfig {
    const config = getConfig();
    return {
        tags: config.tagFilter,
        mode: config.tagFilterMode,
    };
}

/**
 * Filter an array of steps based on tag configuration.
 * Use this for CodeLens and Diagnostics, NOT for navigation.
 * 
 * @param steps Array of steps to filter
 * @param filterConfig Optional filter config (uses settings if not provided)
 * @returns Filtered array of steps
 */
export function filterStepsByTags(steps: FeatureStep[], filterConfig?: TagFilterConfig): FeatureStep[] {
    const config = filterConfig || getTagFilterConfig();
    
    // If no filter, return all steps
    if (!config.tags || config.tags.length === 0) {
        return steps;
    }
    
    return steps.filter(step => shouldShowStep(step, config));
}

// ═══════════════════════════════════════════════════════════════════════════
// WHITESPACE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize whitespace in a string: trim and collapse multiple spaces/tabs to single space.
 * Does not alter quotes or other characters.
 * 
 * @param text The text to normalize
 * @returns Normalized text with trimmed and collapsed whitespace
 */
export function normalizeWhitespace(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
}

