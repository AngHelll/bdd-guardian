/**
 * Rule: Outline Without Examples
 * Flags Scenario Outline without Examples table, or with empty Examples.
 */

import { CoachRule, CoachFinding, GherkinModel, CoachSeverity } from './types';

export const outlineExamplesRule: CoachRule = {
    id: 'coach/outline-examples',
    name: 'Outline Without Examples',
    description: 'Scenario Outline must have at least one Examples table with data rows.',
    severity: 'error',
    
    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        const ruleId = this.id;
        const severity: CoachSeverity = this.severity;
        
        for (const scenario of model.scenarios) {
            if (!scenario.isOutline) {
                continue;
            }
            
            // Check if no Examples at all
            if (scenario.examples.length === 0) {
                findings.push({
                    ruleId,
                    message: `Scenario Outline "${scenario.title}" has no Examples table.`,
                    severity,
                    line: scenario.line,
                    column: 0,
                    endLine: scenario.line,
                    endColumn: 100,
                    fixes: [{
                        title: 'Add Examples table',
                        newText: '\n\n    Examples:\n      | placeholder |\n      | value       |',
                    }],
                });
                continue;
            }
            
            // Check if all Examples are empty
            const hasData = scenario.examples.some(ex => ex.rowCount > 0);
            if (!hasData) {
                findings.push({
                    ruleId,
                    message: `Scenario Outline "${scenario.title}" has Examples but no data rows.`,
                    severity,
                    line: scenario.examples[0].line,
                    column: 0,
                    endLine: scenario.examples[0].line,
                    endColumn: 100,
                });
            }
            
            // Check for unused placeholders
            const placeholders = new Set<string>();
            for (const step of scenario.steps) {
                const matches = step.text.matchAll(/<([^>]+)>/g);
                for (const match of matches) {
                    placeholders.add(match[1]);
                }
            }
            
            for (const examples of scenario.examples) {
                const headerSet = new Set(examples.headers);
                
                // Check for placeholders not in headers
                for (const placeholder of placeholders) {
                    if (!headerSet.has(placeholder)) {
                        findings.push({
                            ruleId,
                            message: `Placeholder <${placeholder}> is used in steps but not defined in Examples headers.`,
                            severity: 'error',
                            line: examples.line,
                            column: 0,
                            endLine: examples.line,
                            endColumn: 100,
                        });
                    }
                }
                
                // Check for headers not used in steps (hint)
                for (const header of examples.headers) {
                    if (header && !placeholders.has(header)) {
                        findings.push({
                            ruleId,
                            message: `Examples header "${header}" is not used as a placeholder in any step.`,
                            severity: 'hint',
                            line: examples.line,
                            column: 0,
                            endLine: examples.line,
                            endColumn: 100,
                        });
                    }
                }
            }
        }
        
        return findings;
    },
};
