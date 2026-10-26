/**
 * Constants and Limits
 * Central place for all magic numbers, limits, and regex patterns
 */

import { englishGherkinKeywords, englishGherkinPatterns } from '../parsing/gherkinDialect';

// ═══════════════════════════════════════════════════════════════════════════
// LIMITS
// ═══════════════════════════════════════════════════════════════════════════

/** Maximum number of example rows to expand for Scenario Outlines */
export const MAX_EXAMPLE_ROWS = 20;

/** Maximum candidate strings to generate per step */
export const MAX_CANDIDATES_PER_STEP = 20;

/** Debounce delay for UI updates (ms) */
export const DEBOUNCE_DELAY_MS = 200;

/** Debounce delay for file watcher events (ms) */
export const FILE_WATCHER_DEBOUNCE_MS = 300;

/** Problems panel source label for binding diagnostics */
export const BINDINGS_DIAGNOSTIC_SOURCE = 'BDD Guardian';

/** Diagnostic code for unbound step quick fixes */
export const UNBOUND_STEP_DIAGNOSTIC_CODE = 'bddGuardian/unbound-step';

/** Diagnostic code for unused (orphan) bindings */
export const ORPHAN_BINDING_DIAGNOSTIC_CODE = 'bddGuardian/orphan-binding';

/** Skip orphan scan when indexed bindings exceed this count */
export const MAX_ORPHAN_BINDING_SCAN = 2000;

// ═══════════════════════════════════════════════════════════════════════════
// SCORING CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Score bonus for matching keyword (Given/When/Then) */
export const SCORE_KEYWORD_MATCH = 120;

/** Score bonus for anchored patterns (^...$) */
export const SCORE_ANCHORED_PATTERN = 30;

/** Score bonus for specific capture groups (\d+, \w+, etc.) */
export const SCORE_SPECIFIC_GROUP = 20;

/** Score penalty for generic wildcards (.*) */
export const PENALTY_WILDCARD = 15;

/** Score penalty for keyword fallback (matching different keyword) */
export const PENALTY_KEYWORD_FALLBACK = 40;

// ═══════════════════════════════════════════════════════════════════════════
// REGEX PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * English Gherkin keywords from the official `en` dialect.
 * Another language is selected per file (`# language:`), not by editing this list.
 * `*` is a step keyword and resolves like And/But.
 */
export const GHERKIN_STEP_KEYWORDS = englishGherkinKeywords.step;
export const GHERKIN_FEATURE_KEYWORDS = englishGherkinKeywords.feature;
export const GHERKIN_RULE_KEYWORDS = englishGherkinKeywords.rule;
export const GHERKIN_BACKGROUND_KEYWORDS = englishGherkinKeywords.background;
export const GHERKIN_SCENARIO_KEYWORDS = englishGherkinKeywords.scenario;
export const GHERKIN_SCENARIO_OUTLINE_KEYWORDS = englishGherkinKeywords.scenarioOutline;
export const GHERKIN_EXAMPLES_KEYWORDS = englishGherkinKeywords.examples;

/** Matches English step keywords, including `*`. */
export const STEP_KEYWORD_REGEX = englishGherkinPatterns.step;

/** Matches tag lines: @tag1 @tag2 */
export const TAG_LINE_REGEX = /^\s*(@[\w-]+(?:\s+@[\w-]+)*)\s*$/;

/** Matches Feature: line (English dialect). */
export const FEATURE_REGEX = englishGherkinPatterns.feature;

/** Matches Rule: line (English dialect). */
export const RULE_REGEX = englishGherkinPatterns.rule;

/** Matches Background: line (English dialect). */
export const BACKGROUND_REGEX = englishGherkinPatterns.background;

/** Matches Scenario: and Example: (English dialect). */
export const SCENARIO_REGEX = englishGherkinPatterns.scenario;

/** Matches Scenario Outline: and Scenario Template: (English dialect). */
export const SCENARIO_OUTLINE_REGEX = englishGherkinPatterns.scenarioOutline;

/** Matches Examples: and Scenarios: (English dialect). */
export const EXAMPLES_REGEX = englishGherkinPatterns.examples;

/** Matches table row: | cell1 | cell2 | */
export const TABLE_ROW_REGEX = /^\s*\|(.+)\|\s*$/;

/**
 * Matches C# step attributes.
 *
 * Unqualified `[Given]` / `[When]` / `[Then]` / `[StepDefinition]` stay valid.
 * The only qualified prefixes accepted are `Reqnroll` and `TechTalk.SpecFlow`
 * (optional `global::`). SpecFlow uses this same parser; its attribute types
 * live in that namespace. Any other prefix is left unrecognized.
 * `Attribute` is the C# suffix on the same type (`GivenAttribute`).
 *
 * Also: extra args (`ExpressionType=…`) and sibling attrs
 * (`[Given("…"), Scope(Tag = "web")]`).
 *
 * Captures:
 * 1) keyword (Given|When|Then|StepDefinition)
 * 2) first string literal argument (verbatim @"..." or regular "...")
 */
export const BINDING_ATTRIBUTE_REGEX =
    /\[\s*(?:(?:global::\s*)?(?:Reqnroll|TechTalk\s*\.\s*SpecFlow)\s*\.\s*)?(Given|When|Then|StepDefinition)(?:Attribute)?\s*\(\s*(@?"(?:[^"\\]|\\.|"")*")\s*(?:,[^)]*)?\)(?:\s*,\s*[^[\]]+)?\s*\]/g;

/** Matches C# class declaration */
export const CLASS_DECLARATION_REGEX = /(?:public|internal|private)?\s*(?:partial\s+)?class\s+(\w+)/g;

/** Matches C# method declaration */
export const METHOD_DECLARATION_REGEX = /(?:public|private|protected|internal)?\s*(?:async\s+)?(?:Task|void)\s+(\w+)\s*\(/g;

/** Placeholder pattern in step text: <placeholder> */
export const PLACEHOLDER_REGEX = /<([^>]+)>/g;

// ═══════════════════════════════════════════════════════════════════════════
// SCORING REGEX PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/** Matches generic wildcards in patterns */
export const WILDCARD_PATTERN = /\(\.\*\)|\(\.\+\)|\.\*|\.\+/g;

/** Matches specific capture groups in patterns */
export const SPECIFIC_GROUP_PATTERN = /\\d\+|\[\^"\]\+|\\w\+|\[\^\\s\]\+/g;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION VALUES
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_CONFIG = {
    caseInsensitive: false,
    tagFilter: [] as string[],
    tagFilterMode: 'include' as const,
    featureGlob: '**/*.feature',
    bindingsGlob: '**/*.cs',
    excludePatterns: ['**/bin/**', '**/obj/**', '**/node_modules/**'],
    maxExampleRows: MAX_EXAMPLE_ROWS,
    enableCodeLens: true,
    enableDiagnostics: true,
    enableDecorations: true,
    debug: false,
    providerIndexMode: 'all' as const,
};
