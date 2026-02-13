/**
 * Coach Mode Rule Types
 * Framework-agnostic BDD best practices validation.
 */

import * as vscode from 'vscode';

/**
 * Severity levels for coach findings.
 * Maps to VS Code DiagnosticSeverity.
 * 'off' means the rule/finding is disabled.
 */
export type CoachSeverity = 'error' | 'warning' | 'info' | 'hint' | 'off';

/**
 * A finding from a coach rule.
 */
export interface CoachFinding {
    /** Rule that generated this finding */
    ruleId: string;
    /** Human-readable message */
    message: string;
    /** Severity level */
    severity: CoachSeverity;
    /** Line number (0-based) */
    line: number;
    /** Column number (0-based) */
    column: number;
    /** End line number (optional) */
    endLine?: number;
    /** End column number (optional) */
    endColumn?: number;
    /** Optional quick fixes */
    fixes?: CoachFix[];
}

/**
 * A quick fix suggestion for a finding.
 */
export interface CoachFix {
    /** Title shown in quick fix menu */
    title: string;
    /** The replacement/new text (optional) */
    newText?: string;
}

/**
 * Parsed Gherkin model for rule analysis.
 */
export interface GherkinModel {
    /** Feature title (if present) */
    featureTitle?: string;
    /** Feature line number */
    featureLine?: number;
    /** All scenarios in the file */
    scenarios: GherkinScenario[];
    /** Background (if present) */
    background?: GherkinBackground;
    /** Feature-level tags */
    featureTags: string[];
}

/**
 * A parsed scenario or scenario outline.
 */
export interface GherkinScenario {
    /** Scenario title */
    title: string;
    /** Line number of the scenario declaration */
    line: number;
    /** Is this a Scenario Outline? */
    isOutline: boolean;
    /** Steps in this scenario */
    steps: GherkinStep[];
    /** Examples tables (for outlines) */
    examples: GherkinExamples[];
    /** Tags on this scenario */
    tags: string[];
}

/**
 * Background section.
 */
export interface GherkinBackground {
    /** Line number */
    line: number;
    /** Steps in the background */
    steps: GherkinStep[];
}

/**
 * A parsed step.
 */
export interface GherkinStep {
    /** Original keyword (Given, When, Then, And, But) */
    keyword: string;
    /** Resolved keyword (Given, When, Then) */
    keywordResolved: 'Given' | 'When' | 'Then';
    /** Step text without keyword */
    text: string;
    /** Full line text */
    fullText: string;
    /** Line number */
    line: number;
}

/**
 * Examples table for Scenario Outline.
 */
export interface GherkinExamples {
    /** Line number of Examples: keyword */
    line: number;
    /** Table headers */
    headers: string[];
    /** Number of data rows */
    rowCount: number;
    /** Tags on this Examples block */
    tags: string[];
}

/**
 * A coach rule interface.
 */
export interface CoachRule {
    /** Unique rule identifier */
    readonly id: string;
    /** Human-readable name */
    readonly name: string;
    /** Rule description */
    readonly description: string;
    /** Default severity */
    readonly severity: CoachSeverity;
    
    /**
     * Run the rule on a parsed Gherkin model.
     * @param model Parsed Gherkin model
     * @returns Array of findings
     */
    run(model: GherkinModel): CoachFinding[];
}

/**
 * Coach configuration from VS Code settings.
 */
export interface CoachConfig {
    severityOverrides?: Record<string, CoachSeverity>;
    disabled?: string[];
    uiLeakage?: {
        keywords: string[];
    };
    stepLength?: {
        max: number;
    };
}

/**
 * Convert CoachSeverity to VS Code DiagnosticSeverity.
 */
export function toVSCodeSeverity(severity: CoachSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'error': return vscode.DiagnosticSeverity.Error;
        case 'warning': return vscode.DiagnosticSeverity.Warning;
        case 'info': return vscode.DiagnosticSeverity.Information;
        case 'hint': return vscode.DiagnosticSeverity.Hint;
        case 'off': return vscode.DiagnosticSeverity.Hint; // Should never reach here
    }
}
