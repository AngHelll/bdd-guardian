/**
 * Coach Rules - Export all built-in rules
 */

export * from './types';
export { scenarioNameRule } from './scenarioNameRule';
export { gwtStructureRule } from './gwtStructureRule';
export { stepLengthRule, createStepLengthRule } from './stepLengthRule';
export { uiLeakageRule, createUiLeakageRule } from './uiLeakageRule';
export { outlineExamplesRule } from './outlineExamplesRule';

import { CoachRule, CoachConfig } from './types';
import { scenarioNameRule } from './scenarioNameRule';
import { gwtStructureRule } from './gwtStructureRule';
import { createStepLengthRule } from './stepLengthRule';
import { createUiLeakageRule } from './uiLeakageRule';
import { outlineExamplesRule } from './outlineExamplesRule';

/**
 * Get all default rules with the given configuration.
 */
export function getDefaultRules(config?: CoachConfig): CoachRule[] {
    return [
        scenarioNameRule,
        gwtStructureRule,
        createStepLengthRule(config),
        createUiLeakageRule(config),
        outlineExamplesRule,
    ];
}
