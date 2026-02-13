/**
 * Rule Engine - Runs Coach rules on a GherkinModel
 */

import { GherkinModel, CoachRule, CoachFinding, CoachConfig, CoachSeverity } from './rules/types';
import { getDefaultRules } from './rules';

export interface RuleEngineResult {
    findings: CoachFinding[];
    rulesRun: number;
    duration: number;
}

/**
 * The Coach Rule Engine.
 * Runs a set of rules against a parsed Gherkin model.
 */
export class RuleEngine {
    private rules: CoachRule[] = [];
    private disabledRules: Set<string> = new Set();
    private severityOverrides: Map<string, CoachSeverity> = new Map();
    
    constructor(config?: CoachConfig) {
        this.rules = getDefaultRules(config);
        
        // Apply configuration
        if (config?.disabled) {
            this.disabledRules = new Set(config.disabled);
        }
        
        if (config?.severityOverrides) {
            for (const [ruleId, severity] of Object.entries(config.severityOverrides)) {
                this.severityOverrides.set(ruleId, severity);
            }
        }
    }
    
    /**
     * Run all enabled rules on the model.
     */
    run(model: GherkinModel): RuleEngineResult {
        const startTime = performance.now();
        const findings: CoachFinding[] = [];
        let rulesRun = 0;
        
        for (const rule of this.rules) {
            // Skip disabled rules
            if (this.disabledRules.has(rule.id)) {
                continue;
            }
            
            try {
                const ruleFindings = rule.run(model);
                rulesRun++;
                
                // Apply severity overrides
                for (const finding of ruleFindings) {
                    const override = this.severityOverrides.get(finding.ruleId);
                    if (override) {
                        finding.severity = override;
                    }
                    
                    // Skip 'off' severity findings
                    if (finding.severity !== 'off') {
                        findings.push(finding);
                    }
                }
            } catch (error) {
                console.error(`[Coach] Rule ${rule.id} threw an error:`, error);
            }
        }
        
        const duration = performance.now() - startTime;
        
        return {
            findings,
            rulesRun,
            duration,
        };
    }
    
    /**
     * Get list of all available rules.
     */
    getRules(): CoachRule[] {
        return [...this.rules];
    }
    
    /**
     * Add a custom rule.
     */
    addRule(rule: CoachRule): void {
        this.rules.push(rule);
    }
    
    /**
     * Disable a rule by ID.
     */
    disableRule(ruleId: string): void {
        this.disabledRules.add(ruleId);
    }
    
    /**
     * Enable a rule by ID.
     */
    enableRule(ruleId: string): void {
        this.disabledRules.delete(ruleId);
    }
    
    /**
     * Override the severity for a rule.
     */
    setSeverityOverride(ruleId: string, severity: CoachSeverity): void {
        this.severityOverrides.set(ruleId, severity);
    }
}
