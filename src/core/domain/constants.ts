/**
 * Constants and Limits
 * Central place for all magic numbers, limits, and regex patterns
 */

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

/** Matches step keywords: Given, When, Then, And, But */
export const STEP_KEYWORD_REGEX = /^\s*(Given|When|Then|And|But)\s+(.+)$/i;

/** Matches tag lines: @tag1 @tag2 */
export const TAG_LINE_REGEX = /^\s*(@[\w-]+(?:\s+@[\w-]+)*)\s*$/;

/** Matches Feature: line */
export const FEATURE_REGEX = /^\s*Feature:\s*(.+)$/i;

/** Matches Background: line */
export const BACKGROUND_REGEX = /^\s*Background:\s*(.*)$/i;

/** Matches Scenario: line */
export const SCENARIO_REGEX = /^\s*Scenario:\s*(.+)$/i;

/** Matches Scenario Outline: line */
export const SCENARIO_OUTLINE_REGEX = /^\s*Scenario Outline:\s*(.+)$/i;

/** Matches Examples: line */
export const EXAMPLES_REGEX = /^\s*Examples:\s*(.*)$/i;

/** Matches table row: | cell1 | cell2 | */
export const TABLE_ROW_REGEX = /^\s*\|(.+)\|\s*$/;

/** Matches C# binding attributes: [Given(@"pattern")], [When("pattern")], etc. */
export const BINDING_ATTRIBUTE_REGEX = /\[(Given|When|Then)\s*\(\s*(@?"(?:[^"\\]|\\.)*")\s*\)\]/g;

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
};
