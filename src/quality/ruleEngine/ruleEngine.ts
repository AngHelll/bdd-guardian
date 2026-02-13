/**
 * Rule Engine
 * Executes quality rules against feature documents
 * 
 * This is the foundation for future linting/education rules.
 * Currently returns empty results - rules will be added later.
 */

import { Rule, RuleContext, RuleResult, RuleSeverity } from './ruleTypes';
import { FeatureDocument, ResolveResult, FeatureStep } from '../../core/domain/types';

/**
 * Rule Engine - Executes registered rules
 */
export class RuleEngine {
    private rules: Rule[] = [];
    private enabledRules: Set<string> = new Set();

    /**
     * Register a rule with the engine
     */
    public registerRule(rule: Rule): void {
        // Avoid duplicates
        if (this.rules.some(r => r.id === rule.id)) {
            console.warn(`[RuleEngine] Rule ${rule.id} already registered`);
            return;
        }
        
        this.rules.push(rule);
        
        // Enable by default if specified
        if (rule.enabledByDefault) {
            this.enabledRules.add(rule.id);
        }
    }

    /**
     * Enable a rule by ID
     */
    public enableRule(ruleId: string): void {
        this.enabledRules.add(ruleId);
    }

    /**
     * Disable a rule by ID
     */
    public disableRule(ruleId: string): void {
        this.enabledRules.delete(ruleId);
    }

    /**
     * Check if a rule is enabled
     */
    public isRuleEnabled(ruleId: string): boolean {
        return this.enabledRules.has(ruleId);
    }

    /**
     * Get all registered rules
     */
    public getRules(): readonly Rule[] {
        return this.rules;
    }

    /**
     * Get enabled rules
     */
    public getEnabledRules(): readonly Rule[] {
        return this.rules.filter(r => this.enabledRules.has(r.id));
    }

    /**
     * Execute all enabled rules against a feature document
     * 
     * @param feature The feature document to evaluate
     * @param resolveResults Optional resolution results for steps
     * @param debug Whether to include debug information
     * @returns Array of rule results (violations found)
     */
    public execute(
        feature: FeatureDocument,
        resolveResults?: ReadonlyMap<FeatureStep, ResolveResult>,
        debug: boolean = false
    ): RuleResult[] {
        const results: RuleResult[] = [];
        
        const context: RuleContext = {
            feature,
            resolveResults,
            config: { debug },
        };

        for (const rule of this.getEnabledRules()) {
            try {
                const ruleResults = rule.evaluate(context);
                results.push(...ruleResults);
            } catch (error) {
                console.error(`[RuleEngine] Error executing rule ${rule.id}:`, error);
            }
        }

        return results;
    }

    /**
     * Execute rules against multiple features
     */
    public executeAll(
        features: readonly FeatureDocument[],
        resolveResultsMap?: ReadonlyMap<string, ReadonlyMap<FeatureStep, ResolveResult>>,
        debug: boolean = false
    ): RuleResult[] {
        const results: RuleResult[] = [];
        
        for (const feature of features) {
            const resolveResults = resolveResultsMap?.get(feature.uri.toString());
            results.push(...this.execute(feature, resolveResults, debug));
        }

        return results;
    }

    /**
     * Convert rule severity to VS Code diagnostic severity
     */
    public static toVsCodeSeverity(severity: RuleSeverity): import('vscode').DiagnosticSeverity {
        const vscode = require('vscode');
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT RULE ENGINE INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

/** Singleton rule engine instance */
let ruleEngineInstance: RuleEngine | null = null;

/**
 * Get the singleton rule engine instance
 */
export function getRuleEngine(): RuleEngine {
    if (!ruleEngineInstance) {
        ruleEngineInstance = new RuleEngine();
        // Register built-in rules here when they are created
        // Example: ruleEngineInstance.registerRule(new NoEmptyScenarioRule());
    }
    return ruleEngineInstance;
}
