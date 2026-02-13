/**
 * Rule: Step Length
 * Warns when step text exceeds a configurable length (default: 120 chars).
 */

import { CoachRule, CoachFinding, GherkinModel, CoachConfig } from './types';

const DEFAULT_MAX_LENGTH = 120;

export function createStepLengthRule(config?: CoachConfig): CoachRule {
    const maxLength = config?.stepLength?.max ?? DEFAULT_MAX_LENGTH;
    
    return {
        id: 'coach/step-length',
        name: 'Step Length',
        description: `Step text should not exceed ${maxLength} characters.`,
        severity: 'hint',
        
        run(model: GherkinModel): CoachFinding[] {
            const findings: CoachFinding[] = [];
            
            // Check all scenarios
            for (const scenario of model.scenarios) {
                for (const step of scenario.steps) {
                    if (step.fullText.length > maxLength) {
                        findings.push({
                            ruleId: this.id,
                            message: `Step is too long (${step.fullText.length} chars, max ${maxLength}). Consider breaking it into multiple steps.`,
                            severity: this.severity,
                            line: step.line,
                            column: 0,
                            endLine: step.line,
                            endColumn: step.fullText.length,
                        });
                    }
                }
            }
            
            // Check background
            if (model.background) {
                for (const step of model.background.steps) {
                    if (step.fullText.length > maxLength) {
                        findings.push({
                            ruleId: this.id,
                            message: `Step is too long (${step.fullText.length} chars, max ${maxLength}). Consider breaking it into multiple steps.`,
                            severity: this.severity,
                            line: step.line,
                            column: 0,
                            endLine: step.line,
                            endColumn: step.fullText.length,
                        });
                    }
                }
            }
            
            return findings;
        },
    };
}

// Default export with default config
export const stepLengthRule = createStepLengthRule();
