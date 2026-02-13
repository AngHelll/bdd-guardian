/**
 * Coach Mode Tests
 */

import { describe, it, expect } from 'vitest';
import { scenarioNameRule } from '../features/coach/rules/scenarioNameRule';
import { gwtStructureRule } from '../features/coach/rules/gwtStructureRule';
import { stepLengthRule, createStepLengthRule } from '../features/coach/rules/stepLengthRule';
import { uiLeakageRule, createUiLeakageRule } from '../features/coach/rules/uiLeakageRule';
import { outlineExamplesRule } from '../features/coach/rules/outlineExamplesRule';
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
            const longText = 'a'.repeat(121);
            const model = createModel([
                createScenario('Test', [
                    createStep('Given', longText, 'Given'),
                ]),
            ]);
            
            const findings = stepLengthRule.run(model);
            
            expect(findings).toHaveLength(1);
            expect(findings[0].ruleId).toBe('coach/step-length');
        });
        
        it('should not flag steps within limit', () => {
            const model = createModel([
                createScenario('Test', [
                    createStep('Given', 'short step', 'Given'),
                ]),
            ]);
            
            const findings = stepLengthRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should respect custom max length config', () => {
            const rule = createStepLengthRule({ stepLength: { max: 50 } });
            const model = createModel([
                createScenario('Test', [
                    createStep('Given', 'a'.repeat(51), 'Given'),
                ]),
            ]);
            
            const findings = rule.run(model);
            
            expect(findings).toHaveLength(1);
        });
    });
    
    describe('uiLeakageRule', () => {
        it('should flag steps with UI keywords', () => {
            const model = createModel([
                createScenario('Test', [
                    createStep('When', 'I click the submit button', 'When'),
                ]),
            ]);
            
            const findings = uiLeakageRule.run(model);
            
            expect(findings.length).toBeGreaterThan(0);
            expect(findings[0].message).toContain('UI implementation detail');
        });
        
        it('should not flag behavior-focused steps', () => {
            const model = createModel([
                createScenario('Test', [
                    createStep('When', 'the user submits the form data', 'When'),
                ]),
            ]);
            
            // 'form' is in the keyword list, so this will flag
            // Let's use a cleaner example
            const model2 = createModel([
                createScenario('Test', [
                    createStep('When', 'the user logs in with valid credentials', 'When'),
                ]),
            ]);
            
            const findings = uiLeakageRule.run(model2);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should respect custom keywords', () => {
            const rule = createUiLeakageRule({ uiLeakage: { keywords: ['custom'] } });
            const model = createModel([
                createScenario('Test', [
                    createStep('When', 'using the custom widget', 'When'),
                ]),
            ]);
            
            const findings = rule.run(model);
            
            expect(findings).toHaveLength(1);
        });
    });
    
    describe('outlineExamplesRule', () => {
        it('should flag Scenario Outline without Examples', () => {
            const model = createModel([
                createScenario('Test outline <param>', [], true, []),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings).toHaveLength(1);
            expect(findings[0].message).toContain('no Examples table');
        });
        
        it('should flag Examples with no data rows', () => {
            const model = createModel([
                createScenario('Test outline <param>', [], true, [
                    { line: 5, headers: ['param'], rowCount: 0, tags: [] },
                ]),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings.some(f => f.message.includes('no data rows'))).toBe(true);
        });
        
        it('should not flag valid Scenario Outline', () => {
            const model = createModel([
                createScenario('Test outline <param>', [
                    createStep('Given', 'value is <param>', 'Given'),
                ], true, [
                    { line: 5, headers: ['param'], rowCount: 2, tags: [] },
                ]),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
        
        it('should flag unused placeholders', () => {
            const model = createModel([
                createScenario('Test outline', [
                    createStep('Given', 'value is <param1>', 'Given'),
                ], true, [
                    { line: 5, headers: ['param2'], rowCount: 2, tags: [] },
                ]),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings.some(f => f.message.includes('not defined in Examples'))).toBe(true);
        });
        
        it('should not flag regular scenarios', () => {
            const model = createModel([
                createScenario('Regular scenario', [
                    createStep('Given', 'something', 'Given'),
                ], false, []),
            ]);
            
            const findings = outlineExamplesRule.run(model);
            
            expect(findings).toHaveLength(0);
        });
    });
});
