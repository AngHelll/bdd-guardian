/**
 * Reference search types (framework-agnostic).
 */

import type { FeatureStep } from '../domain/types';

/** Why a step was included in a reference list */
export type StepReferenceKind = 'same-binding' | 'same-text';

export interface StepReferenceMatch {
    readonly step: FeatureStep;
    readonly kind: StepReferenceKind;
}
