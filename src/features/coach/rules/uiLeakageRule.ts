/**
 * Rule: UI Leakage
 * Detects UI implementation details in step text.
 */

import { CoachRule, CoachFinding, GherkinModel, CoachConfig } from './types';

const DEFAULT_KEYWORDS = [
    'click',
    'button',
    'link',
    'input',
    'textbox',
    'dropdown',
    'checkbox',
    'radio',
    'select',
    'form',
    'submit',
    'page',
    'screen',
    'modal',
    'popup',
    'dialog',
    'tab',
    'menu',
    'hover',
    'scroll',
    'drag',
    'drop',
    'css',
    'xpath',
    'id=',
    'class=',
    'locator',
    'element',
    'div',
    'span',
    'href',
];

export function createUiLeakageRule(config?: CoachConfig): CoachRule {
    const keywords = config?.uiLeakage?.keywords ?? DEFAULT_KEYWORDS;
    const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');
    
    return {
        id: 'coach/ui-leakage',
        name: 'UI Leakage',
        description: 'Steps should describe behavior, not UI implementation details.',
        severity: 'warning',
        
        run(model: GherkinModel): CoachFinding[] {
            const findings: CoachFinding[] = [];
            const ruleId = this.id;
            const severity = this.severity;
            
            const checkStep = (step: { fullText: string; text: string; line: number }) => {
                const match = step.text.match(keywordPattern);
                if (match) {
                    findings.push({
                        ruleId,
                        message: `Step contains UI implementation detail "${match[1]}". Rephrase to describe behavior, not UI elements.`,
                        severity,
                        line: step.line,
                        column: 0,
                        endLine: step.line,
                        endColumn: step.fullText.length,
                        fixes: [{
                            title: `Rephrase step to avoid UI term "${match[1]}"`,
                        }],
                    });
                }
            };
            
            // Check all scenarios
            for (const scenario of model.scenarios) {
                for (const step of scenario.steps) {
                    checkStep(step);
                }
            }
            
            // Check background
            if (model.background) {
                for (const step of model.background.steps) {
                    checkStep(step);
                }
            }
            
            return findings;
        },
    };
}

// Default export with default config
export const uiLeakageRule = createUiLeakageRule();
