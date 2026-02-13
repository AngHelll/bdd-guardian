/**
 * Rule: GWT Structure
 * Ensures scenarios follow Given-When-Then order.
 */

import { CoachRule, CoachFinding, GherkinModel, GherkinScenario } from './types';

type GWTKeyword = 'Given' | 'When' | 'Then';

const ORDER: Record<GWTKeyword, number> = {
    'Given': 0,
    'When': 1,
    'Then': 2,
};

export const gwtStructureRule: CoachRule = {
    id: 'coach/gwt-structure',
    name: 'GWT Structure',
    description: 'Scenarios should follow Given → When → Then order.',
    severity: 'warning',
    
    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        
        for (const scenario of model.scenarios) {
            const issues = checkScenarioStructure(scenario, this.id, this.severity);
            findings.push(...issues);
        }
        
        return findings;
    },
};

function checkScenarioStructure(
    scenario: GherkinScenario,
    ruleId: string,
    severity: 'error' | 'warning' | 'info' | 'hint' | 'off'
): CoachFinding[] {
    const issues: CoachFinding[] = [];
    const steps = scenario.steps;
    
    if (steps.length === 0) {
        return issues;
    }
    
    // Check for missing sections
    const hasGiven = steps.some(s => s.keywordResolved === 'Given');
    const hasWhen = steps.some(s => s.keywordResolved === 'When');
    const hasThen = steps.some(s => s.keywordResolved === 'Then');
    
    if (!hasGiven) {
        issues.push({
            ruleId,
            severity,
            message: `Scenario "${scenario.title}" is missing a Given step (preconditions).`,
            line: scenario.line,
            column: 0,
            endLine: scenario.line,
            endColumn: 100,
        });
    }
    
    if (!hasWhen) {
        issues.push({
            ruleId,
            severity,
            message: `Scenario "${scenario.title}" is missing a When step (action).`,
            line: scenario.line,
            column: 0,
            endLine: scenario.line,
            endColumn: 100,
        });
    }
    
    if (!hasThen) {
        issues.push({
            ruleId,
            severity,
            message: `Scenario "${scenario.title}" is missing a Then step (expected outcome).`,
            line: scenario.line,
            column: 0,
            endLine: scenario.line,
            endColumn: 100,
        });
    }
    
    // Check order violations
    let lastOrder = -1;
    let lastKeyword: GWTKeyword | null = null;
    
    for (const step of steps) {
        const currentOrder = ORDER[step.keywordResolved];
        
        // Going backwards? (e.g., Then → Given)
        if (currentOrder < lastOrder) {
            issues.push({
                ruleId,
                severity,
                message: `Step "${step.keyword} ${step.text.substring(0, 30)}..." breaks GWT order. Found ${step.keywordResolved} after ${lastKeyword}.`,
                line: step.line,
                column: 0,
                endLine: step.line,
                endColumn: step.fullText.length,
            });
        }
        
        lastOrder = currentOrder;
        lastKeyword = step.keywordResolved;
    }
    
    return issues;
}
