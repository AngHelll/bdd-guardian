/**
 * Coach Mode Tests
 */

import { describe, it, expect } from 'vitest';
import { scenarioNameRule } from '../features/coach/rules/scenarioNameRule';
import { gwtStructureRule } from '../features/coach/rules/gwtStructureRule';
import { stepLengthRule, createStepLengthRule } from '../features/coach/rules/stepLengthRule';
import { uiLeakageRule, createUiLeakageRule } from '../features/coach/rules/uiLeakageRule';
import { outlineExamplesRule } from '../features/coach/rules/outlineExamplesRule';
import { DuplicateStepsRule } from '../features/coach/rules/duplicateStepsRule';
import { VagueThenRule } from '../features/coach/rules/vagueThenRule';
import { TooManyStepsRule } from '../features/coach/rules/tooManyStepsRule';
import { GherkinModel, GherkinScenario, GherkinStep } from '../features/coach/rules/types';

// Helper to create test models
function createModel(scenarios: GherkinScenario[]): GherkinModel {
    return {
        scenarios,
        featureTags: [],
    };
}

function createScenario(
    title: string,
    steps: GherkinStep[],
    isOutline = false,
    examples: { line: number; headers: string[]; rowCount: number; tags: string[] }[] = []
): GherkinScenario {
    return {
        title,
        line: 1,
        isOutline,
        steps,
        examples,
        tags: [],
    };
}

function createStep(
    keyword: string,
    text: string,
    keywordResolved: 'Given' | 'When' | 'Then' = 'Given',
    line = 2
): GherkinStep {
    return {
        keyword,
        keywordResolved,
        text,
        fullText: `${keyword} ${text}`,
        line,
    };
}

describe('Coach Rules', () => {
    describe('scenarioNameRule', () => {
        it('should flag scenarios with fewer than 3 words', () => {
            const model = createModel([
                createScenario('Login', []),
            ]);
            
            const findings = scenarioNameRule.run(model);
            
            expect(findings).toHaveLength(1);
            expect(findings[0].ruleId).toBe('coach/scenario-name');
            expect(findings[0].message).toContain('too vague');
        });
        
        it('should not flag scenarios with 3 or more words', () => {
            const model = createModel([
                createScenario('User successfully logs in', []),
            ]);
            
            const findings = scenarioNameRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should count words correctly', () => {
            const model = createModel([
                createScenario('Two words', []),
            ]);
            
            const findings = scenarioNameRule.run(model);
            
            expect(findings).toHaveLength(1);
            expect(findings[0].message).toContain('2 words');
        });
    });
    
    describe('gwtStructureRule', () => {
        it('should flag scenarios missing Given', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('When', 'action happens', 'When'),
                    createStep('Then', 'result is seen', 'Then'),
                ]),
            ]);
            
            const findings = gwtStructureRule.run(model);
            
            expect(findings.some(f => f.message.includes('missing a Given step'))).toBe(true);
        });
        
        it('should flag scenarios missing When', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', 'precondition', 'Given'),
                    createStep('Then', 'result is seen', 'Then'),
                ]),
            ]);
            
            const findings = gwtStructureRule.run(model);
            
            expect(findings.some(f => f.message.includes('missing a When step'))).toBe(true);
        });
        
        it('should flag scenarios missing Then', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', 'precondition', 'Given'),
                    createStep('When', 'action happens', 'When'),
                ]),
            ]);
            
            const findings = gwtStructureRule.run(model);
            
            expect(findings.some(f => f.message.includes('missing a Then step'))).toBe(true);
        });
        
        it('should not flag complete GWT scenarios', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', 'precondition', 'Given'),
                    createStep('When', 'action happens', 'When'),
                    createStep('Then', 'result is seen', 'Then'),
                ]),
            ]);
            
            const findings = gwtStructureRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should flag out-of-order steps', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', 'precondition', 'Given', 2),
                    createStep('Then', 'result is seen', 'Then', 3),
                    createStep('When', 'action happens', 'When', 4),
                ]),
            ]);
            
            const findings = gwtStructureRule.run(model);
            
            expect(findings.some(f => f.message.includes('breaks GWT order'))).toBe(true);
        });
    });
    
    describe('stepLengthRule', () => {
        it('should flag steps longer than default max (120)', () => {
            const longStep = 'a'.repeat(130);
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', longStep, 'Given'),
                ]),
            ]);
            
            const findings = stepLengthRule.run(model);
            
            expect(findings).toHaveLength(1);
            expect(findings[0].ruleId).toBe('coach/step-length');
        });
        
        it('should not flag steps within limit', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', 'a short step', 'Given'),
                ]),
            ]);
            
            const findings = stepLengthRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should respect custom max length config', () => {
            const customRule = createStepLengthRule({ stepLength: { max: 50 } });
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('Given', 'a'.repeat(60), 'Given'),
                ]),
            ]);
            
            const findings = customRule.run(model);
            
            expect(findings).toHaveLength(1);
        });
    });
    
    describe('uiLeakageRule', () => {
        it('should flag steps with UI keywords', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('When', 'I click the submit button', 'When'),
                ]),
            ]);
            
            const findings = uiLeakageRule.run(model);
            
            expect(findings).toHaveLength(1);
            expect(findings[0].ruleId).toBe('coach/ui-leakage');
        });
        
        it('should not flag behavior-focused steps', () => {
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('When', 'I complete the registration', 'When'),
                ]),
            ]);
            
            const findings = uiLeakageRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should respect custom keywords', () => {
            const customRule = createUiLeakageRule({ uiLeakage: { keywords: ['tap', 'swipe'] } });
            const model = createModel([
                createScenario('Test scenario', [
                    createStep('When', 'I tap the screen', 'When'),
                ]),
            ]);
            
            const findings = customRule.run(model);
            
            expect(findings).toHaveLength(1);
        });
    });
    
    describe('outlineExamplesRule', () => {
        it('should flag Scenario Outline without Examples', () => {
            const model = createModel([
                createScenario('Login with <username>', [
                    createStep('Given', 'I am user <username>', 'Given'),
                ], true, []),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings.some(f => f.message.includes('has no Examples'))).toBe(true);
        });
        
        it('should flag Examples with no data rows', () => {
            const model = createModel([
                createScenario('Login with <username>', [
                    createStep('Given', 'I am user <username>', 'Given'),
                ], true, [{ line: 10, headers: ['username'], rowCount: 0, tags: [] }]),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings.some(f => f.message.includes('no data rows'))).toBe(true);
        });
        
        it('should not flag valid Scenario Outline', () => {
            const model = createModel([
                createScenario('Login with <username>', [
                    createStep('Given', 'I am user <username>', 'Given'),
                ], true, [{ line: 10, headers: ['username'], rowCount: 2, tags: [] }]),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should flag unused placeholders', () => {
            const model = createModel([
                createScenario('Login with <username>', [
                    createStep('Given', 'I am a user', 'Given'),
                ], true, [{ line: 10, headers: ['username'], rowCount: 2, tags: [] }]),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings.some(f => f.message.includes('unused') || f.message.includes('not used'))).toBe(true);
        });
        
        it('should not flag regular scenarios', () => {
            const model = createModel([
                createScenario('Regular scenario', [
                    createStep('Given', 'I am a user', 'Given'),
                ], false, []),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
    });
});

// ============= NEW RULES V2 =============

describe('DuplicateStepsRule', () => {
    it('should detect steps repeated 3+ times across scenarios', () => {
        const rule = new DuplicateStepsRule();
        
        const model: GherkinModel = {
            scenarios: [
                createScenario('Scenario 1', [
                    createStep('Given', 'user is logged in', 'Given'),
                ]),
                createScenario('Scenario 2', [
                    createStep('Given', 'user is logged in', 'Given'),
                ]),
                createScenario('Scenario 3', [
                    createStep('Given', 'user is logged in', 'Given'),
                ]),
            ],
            featureTags: [],
        };
        
        const findings = rule.run(model);
        expect(findings.length).toBeGreaterThan(0);
        expect(findings[0].message).toContain('appears');
    });
    
    it('should not flag unique steps', () => {
        const rule = new DuplicateStepsRule();
        
        const model: GherkinModel = {
            scenarios: [
                createScenario('Scenario 1', [
                    createStep('Given', 'first step', 'Given'),
                ]),
                createScenario('Scenario 2', [
                    createStep('Given', 'second step', 'Given'),
                ]),
            ],
            featureTags: [],
        };
        
        const findings = rule.run(model);
        expect(findings.length).toBe(0);
    });
});

describe('VagueThenRule', () => {
    it('should flag vague Then assertions', () => {
        const rule = new VagueThenRule();
        
        const model: GherkinModel = {
            scenarios: [
                createScenario('Test Scenario', [
                    createStep('Then', 'it works', 'Then'),
                ]),
            ],
            featureTags: [],
        };
        
        const findings = rule.run(model);
        expect(findings.length).toBeGreaterThan(0);
        expect(findings[0].message).toContain('Vague assertion');
    });
    
    it('should accept specific Then assertions', () => {
        const rule = new VagueThenRule();
        
        const model: GherkinModel = {
            scenarios: [
                createScenario('Test Scenario', [
                    createStep('Then', 'the user should see the dashboard with their name displayed', 'Then'),
                ]),
            ],
            featureTags: [],
        };
        
        const findings = rule.run(model);
        expect(findings.length).toBe(0);
    });
});

describe('TooManyStepsRule', () => {
    it('should flag scenarios with more than 10 steps', () => {
        const rule = new TooManyStepsRule(10);
        
        const steps: GherkinStep[] = Array.from({ length: 12 }, (_, i) => ({
            keyword: i === 0 ? 'Given' : i === 1 ? 'When' : 'Then',
            keywordResolved: (i === 0 ? 'Given' : i === 1 ? 'When' : 'Then') as 'Given' | 'When' | 'Then',
            text: `step ${i + 1}`,
            fullText: `${i === 0 ? 'Given' : i === 1 ? 'When' : 'Then'} step ${i + 1}`,
            line: i + 4,
        }));
        
        const model: GherkinModel = {
            scenarios: [
                {
                    title: 'Long Scenario',
                    line: 3,
                    isOutline: false,
                    steps,
                    examples: [],
                    tags: [],
                },
            ],
            featureTags: [],
        };
        
        const findings = rule.run(model);
        expect(findings.length).toBeGreaterThan(0);
        expect(findings[0].message).toContain('12 steps');
    });
    
    it('should not flag short scenarios', () => {
        const rule = new TooManyStepsRule(10);
        
        const model: GherkinModel = {
            scenarios: [
                createScenario('Short Scenario', [
                    createStep('Given', 'step one', 'Given'),
                    createStep('When', 'step two', 'When'),
                    createStep('Then', 'step three', 'Then'),
                ]),
            ],
            featureTags: [],
        };
        
        const findings = rule.run(model);
        const warnings = findings.filter(f => f.severity === 'warning');
        expect(warnings.length).toBe(0);
    });
});
