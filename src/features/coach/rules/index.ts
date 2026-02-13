/**
 * Coach Rules - Export all built-in rules
 * 
 * v2.0: Added duplicate steps, vague then, too many steps rules
 */

export * from './types';
export { scenarioNameRule } from './scenarioNameRule';
export { gwtStructureRule } from './gwtStructureRule';
export { stepLengthRule, createStepLengthRule } from './stepLengthRule';
export { uiLeakageRule, createUiLeakageRule } from './uiLeakageRule';
export { outlineExamplesRule } from './outlineExamplesRule';
export { DuplicateStepsRule } from './duplicateStepsRule';
export { VagueThenRule } from './vagueThenRule';
export { TooManyStepsRule } from './tooManyStepsRule';

import { CoachRule, CoachConfig } from './types';
import { scenarioNameRule } from './scenarioNameRule';
import { gwtStructureRule } from './gwtStructureRule';
import { createStepLengthRule } from './stepLengthRule';
import { createUiLeakageRule } from './uiLeakageRule';
import { outlineExamplesRule } from './outlineExamplesRule';
import { DuplicateStepsRule } from './duplicateStepsRule';
import { VagueThenRule } from './vagueThenRule';
import { TooManyStepsRule } from './tooManyStepsRule';

/**
 * Get all default rules with the given configuration.
 */
export function getDefaultRules(config?: CoachConfig): CoachRule[] {
    return [
        // Original rules (v1)
        scenarioNameRule,
        gwtStructureRule,
        createStepLengthRule(config),
        createUiLeakageRule(config),
        outlineExamplesRule,
        // New rules (v2)
        new DuplicateStepsRule(),
        new VagueThenRule(),
        new TooManyStepsRule(),
    ];
}

/**
 * Get all rule metadata for documentation/UI.
 */
export function getAllRuleInfo(): { id: string; name: string; description: string }[] {
    return [
        { id: 'coach/scenario-name', name: 'Scenario Name Smell', description: 'Scenario titles should be descriptive (at least 3 words).' },
        { id: 'coach/gwt-structure', name: 'GWT Structure', description: 'Scenarios should follow Given → When → Then order.' },
        { id: 'coach/step-length', name: 'Step Length', description: 'Step text should not exceed configured length.' },
        { id: 'coach/ui-leakage', name: 'UI Leakage', description: 'Steps should describe behavior, not UI implementation details.' },
        { id: 'coach/outline-examples', name: 'Outline Without Examples', description: 'Scenario Outline must have at least one Examples table with data rows.' },
        { id: 'coach/duplicate-steps', name: 'Duplicate Steps', description: 'Detects repeated step text that could indicate copy-paste errors or missing abstractions.' },
        { id: 'coach/vague-then', name: 'Vague Then Assertion', description: 'Then steps should assert specific, observable outcomes, not vague statements.' },
        { id: 'coach/too-many-steps', name: 'Too Many Steps', description: 'Scenarios should be focused and have a reasonable number of steps.' },
    ];
}
