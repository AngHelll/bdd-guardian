/**
 * Too Many Steps Rule
 * Detects scenarios with an excessive number of steps.
 * 
 * Why: Long scenarios are hard to read, maintain, and often test
 * multiple behaviors. They should be split into smaller, focused scenarios.
 */

import { CoachRule, CoachFinding, GherkinModel, CoachSeverity } from './types';

/** Default maximum steps per scenario */
const DEFAULT_MAX_STEPS = 10;

/** Warning threshold (info before this, warning after) */
const WARNING_THRESHOLD = 8;

/**
 * Rule that detects scenarios with too many steps.
 */
export class TooManyStepsRule implements CoachRule {
    readonly id = 'coach/too-many-steps';
    readonly name = 'Too Many Steps';
    readonly description = 'Scenarios should be focused and have a reasonable number of steps.';
    readonly severity: CoachSeverity = 'warning';
    
    private maxSteps: number;
    
    constructor(maxSteps: number = DEFAULT_MAX_STEPS) {
        this.maxSteps = maxSteps;
    }

    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        
        for (const scenario of model.scenarios) {
            const stepCount = scenario.steps.length;
            
            if (stepCount > this.maxSteps) {
                findings.push({
                    ruleId: this.id,
                    message: `Scenario "${scenario.title}" has ${stepCount} steps (max: ${this.maxSteps}). Consider splitting into smaller, focused scenarios.`,
                    severity: 'warning',
                    line: scenario.line,
                    column: 0,
                    fixes: [
                        {
                            title: 'Split into multiple focused scenarios',
                        },
                        {
                            title: 'Move setup steps to Background',
                        }
                    ]
                });
            } else if (stepCount >= WARNING_THRESHOLD) {
                findings.push({
                    ruleId: this.id,
                    message: `Scenario "${scenario.title}" has ${stepCount} steps. Consider if it could be simplified.`,
                    severity: 'info',
                    line: scenario.line,
                    column: 0,
                });
            }
        }
        
        return findings;
    }
}
