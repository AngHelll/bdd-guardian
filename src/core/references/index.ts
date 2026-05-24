/**
 * Reference search module exports
 */

export type { StepReferenceKind, StepReferenceMatch } from './types';
export { sameBinding, getBindingsForUri, findBindingAtLine } from './bindingIdentity';
export {
    collectAllIndexedSteps,
    findReferencesForBinding,
    findReferencesForStep,
    stepLocationKey,
    type ResolveStep,
} from './referenceFinder';
export { getStepAtPosition, isFeatureDocument } from './stepContext';
