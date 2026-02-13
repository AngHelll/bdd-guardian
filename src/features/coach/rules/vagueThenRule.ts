/**
 * Vague Then Rule
 * Detects Then steps that are too vague or don't assert anything meaningful.
 * 
 * Why: Then steps should verify specific, observable outcomes.
 * Vague assertions like "it works" or "success" don't provide value.
 */

import { CoachRule, CoachFinding, GherkinModel, CoachSeverity } from './types';

/** Words that indicate a vague assertion */
const VAGUE_PATTERNS = [
    /^(it|this|that)\s+(works?|is\s+(ok|fine|good|correct|right|successful))/i,
    /^(should\s+)?(be\s+)?(ok|fine|good|correct|right|successful|valid)$/i,
    /^(the\s+)?(result|response|output)\s+(is|should\s+be)\s+(ok|fine|good|correct|right|successful|valid)$/i,
    /^everything\s+(is|works)/i,
    /^no\s+error/i,
    /^success$/i,
];

/** Minimum word count for a meaningful Then step */
const MIN_WORDS = 4;

/**
 * Rule that detects vague or meaningless Then assertions.
 */
export class VagueThenRule implements CoachRule {
    readonly id = 'coach/vague-then';
    readonly name = 'Vague Then Assertion';
    readonly description = 'Then steps should assert specific, observable outcomes, not vague statements.';
    readonly severity: CoachSeverity = 'warning';

    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        
        for (const scenario of model.scenarios) {
            for (const step of scenario.steps) {
                // Only check Then steps
                if (step.keywordResolved !== 'Then') {
                    continue;
                }
                
                const finding = this.checkVagueness(step.text, step.line);
                if (finding) {
                    findings.push(finding);
                }
            }
        }
        
        return findings;
    }
    
    /**
     * Check if the step text is too vague.
     */
    private checkVagueness(text: string, line: number): CoachFinding | null {
        const normalizedText = text.trim().toLowerCase();
        
        // Check against vague patterns
        for (const pattern of VAGUE_PATTERNS) {
            if (pattern.test(normalizedText)) {
                return {
                    ruleId: this.id,
                    message: `Vague assertion: "${text}". Then steps should verify specific outcomes.`,
                    severity: this.severity,
                    line,
                    column: 0,
                    fixes: [
                        {
                            title: 'Rewrite to assert a specific, observable outcome',
                        }
                    ]
                };
            }
        }
        
        // Check word count
        const words = text.trim().split(/\s+/);
        if (words.length < MIN_WORDS) {
            return {
                ruleId: this.id,
                message: `Then step "${text}" is too short (${words.length} words). Be more specific about the expected outcome.`,
                severity: 'info',
                line,
                column: 0,
            };
        }
        
        return null;
    }
}
