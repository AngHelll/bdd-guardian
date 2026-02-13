/**
 * Coach Mode v2 - BDD Best Practices Validator
 * 
 * This module provides a lightweight linter for .feature files that warns
 * about common BDD anti-patterns and suggests improvements.
 * 
 * v2 Features:
 * - 8 built-in rules (5 original + 3 new)
 * - Health Score with grade (A-F) and suggestions
 * - Configurable severity per rule
 * - Quick fixes for common issues
 * - Minimal UI footprint (only diagnostics)
 * 
 * New Rules in v2:
 * - Duplicate Steps: Detects repeated step text
 * - Vague Then: Flags non-specific assertions
 * - Too Many Steps: Warns about overly long scenarios
 */

export { parseGherkinDocument } from './gherkinParser';
export { RuleEngine, RuleEngineResult } from './ruleEngine';
export { CoachDiagnosticsProvider } from './coachDiagnostics';
export { CoachQuickFixProvider, registerCoachCommands } from './quickFixes';
export { getCoachConfig, isCoachEnabled, isStatusBarEnabled } from './config';
export { calculateHealthScore, formatHealthReport, HealthScoreResult } from './healthScore';
export * from './rules';
