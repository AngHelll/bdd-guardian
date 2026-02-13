/**
 * Rule Types
 * Type definitions for the quality rule engine
 * 
 * This is the foundation for future linting/education rules.
 * Currently empty - rules will be added later.
 */

import * as vscode from 'vscode';
import { FeatureDocument, FeatureStep, Scenario, ResolveResult } from '../../core/domain/types';

// ═══════════════════════════════════════════════════════════════════════════
// RULE SEVERITY
// ═══════════════════════════════════════════════════════════════════════════

/** Rule severity levels */
export type RuleSeverity = 'error' | 'warning' | 'info' | 'hint';

// ═══════════════════════════════════════════════════════════════════════════
// RULE CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Context provided to rules for evaluation
 */
export interface RuleContext {
    /** The feature document being evaluated */
    readonly feature: FeatureDocument;
    /** Resolution results for all steps (if needed) */
    readonly resolveResults?: ReadonlyMap<FeatureStep, ResolveResult>;
    /** Extension configuration */
    readonly config: {
        readonly debug: boolean;
        // Add more config as needed
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE RESULT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of a rule evaluation
 */
export interface RuleResult {
    /** Rule identifier */
    readonly ruleId: string;
    /** Rule name (human readable) */
    readonly ruleName: string;
    /** Severity of this result */
    readonly severity: RuleSeverity;
    /** Message describing the issue */
    readonly message: string;
    /** Location of the issue */
    readonly range: vscode.Range;
    /** URI of the file */
    readonly uri: vscode.Uri;
    /** Optional fix suggestion */
    readonly fixSuggestion?: string;
    /** Related information (e.g., other locations involved) */
    readonly relatedInformation?: readonly vscode.DiagnosticRelatedInformation[];
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interface for a quality rule
 */
export interface Rule {
    /** Unique rule identifier */
    readonly id: string;
    /** Human-readable rule name */
    readonly name: string;
    /** Rule description */
    readonly description: string;
    /** Default severity */
    readonly defaultSeverity: RuleSeverity;
    /** Rule category */
    readonly category: RuleCategory;
    /** Whether rule is enabled by default */
    readonly enabledByDefault: boolean;

    /**
     * Evaluate the rule against a feature
     * @param context The rule context
     * @returns Array of rule results (violations)
     */
    evaluate(context: RuleContext): RuleResult[];
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

/** Categories of rules */
export type RuleCategory = 
    | 'best-practice'      // BDD best practices
    | 'naming'             // Naming conventions
    | 'structure'          // Feature/scenario structure
    | 'maintainability'    // Code maintainability
    | 'education';         // Learning/mentoring hints

// ═══════════════════════════════════════════════════════════════════════════
// RULE METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Metadata for rule registration
 */
export interface RuleMetadata {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category: RuleCategory;
    readonly documentation?: string; // URL to documentation
}
