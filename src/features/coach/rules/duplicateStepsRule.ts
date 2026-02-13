/**
 * Duplicate Steps Rule
 * Detects repeated step text within scenarios and across the feature file.
 * 
 * Why: Duplicate steps often indicate:
 * - Copy-paste errors
 * - Missing background steps
 * - Steps that could be parameterized
 */

import { CoachRule, CoachFinding, GherkinModel, GherkinScenario, GherkinStep, CoachSeverity } from './types';

/**
 * Rule that detects duplicate step text within a feature file.
 */
export class DuplicateStepsRule implements CoachRule {
    readonly id = 'coach/duplicate-steps';
    readonly name = 'Duplicate Steps';
    readonly description = 'Detects repeated step text that could indicate copy-paste errors or missing abstractions.';
    readonly severity: CoachSeverity = 'info';

    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        
        // Track all steps with their locations
        const stepOccurrences = new Map<string, { scenario: string; step: GherkinStep }[]>();
        
        // Collect steps from all scenarios
        for (const scenario of model.scenarios) {
            for (const step of scenario.steps) {
                const key = this.normalizeStepText(step.text);
                const existing = stepOccurrences.get(key) ?? [];
                existing.push({ scenario: scenario.title, step });
                stepOccurrences.set(key, existing);
            }
        }
        
        // Find duplicates
        for (const [stepText, occurrences] of stepOccurrences.entries()) {
            if (occurrences.length >= 3) {
                // Same step appears in 3+ places - suggest Background
                const firstOccurrence = occurrences[0];
                findings.push({
                    ruleId: this.id,
                    message: `Step "${stepText}" appears ${occurrences.length} times. Consider moving to Background.`,
                    severity: 'warning',
                    line: firstOccurrence.step.line,
                    column: 0,
                    fixes: [
                        {
                            title: 'Consider moving common steps to Background',
                        }
                    ]
                });
            }
        }
        
        // Check for duplicates within same scenario
        for (const scenario of model.scenarios) {
            const scenarioSteps = new Map<string, GherkinStep[]>();
            
            for (const step of scenario.steps) {
                const key = this.normalizeStepText(step.text);
                const existing = scenarioSteps.get(key) ?? [];
                existing.push(step);
                scenarioSteps.set(key, existing);
            }
            
            for (const [stepText, steps] of scenarioSteps.entries()) {
                if (steps.length > 1) {
                    // Same exact step appears multiple times in same scenario
                    findings.push({
                        ruleId: this.id,
                        message: `Step "${stepText}" is repeated ${steps.length} times in "${scenario.title}". This may be a copy-paste error.`,
                        severity: 'warning',
                        line: steps[1].line, // Flag the second occurrence
                        column: 0,
                    });
                }
            }
        }
        
        return findings;
    }
    
    /**
     * Normalize step text for comparison (lowercase, trim whitespace).
     */
    private normalizeStepText(text: string): string {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }
}
