/**
 * Rule: Scenario Name Smell
 * Detects scenario titles that are too vague (fewer than 3 words).
 */

import { CoachRule, CoachFinding, GherkinModel } from './types';

export const scenarioNameRule: CoachRule = {
    id: 'coach/scenario-name',
    name: 'Scenario Name Smell',
    description: 'Scenario titles should be descriptive (at least 3 words).',
    severity: 'warning',
    
    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        
        for (const scenario of model.scenarios) {
            const words = scenario.title.trim().split(/\s+/).filter(w => w.length > 0);
            
            if (words.length < 3) {
                findings.push({
                    ruleId: this.id,
                    message: `Scenario title "${scenario.title}" is too vague (${words.length} word${words.length === 1 ? '' : 's'}). Consider a more descriptive name.`,
                    severity: this.severity,
                    line: scenario.line,
                    column: 0,
                    endLine: scenario.line,
                    endColumn: scenario.title.length + 20,
                    fixes: [{
                        title: 'Add more descriptive words to scenario title',
                    }],
                });
            }
        }
        
        return findings;
    },
};
