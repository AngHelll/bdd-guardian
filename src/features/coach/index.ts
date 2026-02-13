/**
 * Coach Mode - BDD Best Practices Validator
 * 
 * This module provides a lightweight linter for .feature files that warns
 * about common BDD anti-patterns and suggests improvements.
 * 
 * Features:
 * - 5 built-in rules (scenario names, GWT structure, step length, UI leakage, outline examples)
 * - Configurable severity per rule
 * - Quick fixes for common issues
 * - Minimal UI footprint (only diagnostics)
 */

export { parseGherkinDocument } from './gherkinParser';
export { RuleEngine, RuleEngineResult } from './ruleEngine';
export { CoachDiagnosticsProvider } from './coachDiagnostics';
export { CoachQuickFixProvider, registerCoachCommands } from './quickFixes';
export { getCoachConfig, isCoachEnabled, isStatusBarEnabled } from './config';
export * from './rules';
