/**
 * Reference search module exports
 */

export type { StepReferenceKind, StepReferenceMatch } from './types';
export { sameBinding, getBindingsForUri, findBindingAtLine } from './bindingIdentity';
export {
    collectAllIndexedSteps,
    findReferencesForBinding,
    findReferencesForStep,
    listOrphanBindings,
    stepLocationKey,
    type ResolveStep,
} from './referenceFinder';
export { getStepAtPosition, getStepAtPositionFromContent, featureTextDocument, isFeatureDocument, resolveStepAtPosition } from './stepContext';
