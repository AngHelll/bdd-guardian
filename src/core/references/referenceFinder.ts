/**
 * Find All References — core logic (no VS Code UI).
 *
 * - Binding → feature steps that resolve to that binding
 * - Feature step → other steps with the same binding and/or same normalized text
 */

import type { Binding, FeatureStep, ResolveResult } from '../domain/types';
import type { WorkspaceIndex } from '../index/workspaceIndex';
import type { StepReferenceKind, StepReferenceMatch } from './types';
import { sameBinding } from './bindingIdentity';

export type ResolveStep = (step: FeatureStep) => ResolveResult;

export function collectAllIndexedSteps(index: WorkspaceIndex): FeatureStep[] {
    const steps: FeatureStep[] = [];
    for (const feature of index.getAllFeatures()) {
        steps.push(...feature.allSteps);
    }
    return steps;
}

export function stepLocationKey(step: FeatureStep): string {
    return `${step.uri.toString()}:${step.lineNumber}`;
}

function compareStepLocation(a: FeatureStep, b: FeatureStep): number {
    const pathCmp = a.uri.fsPath.localeCompare(b.uri.fsPath);
    if (pathCmp !== 0) {
        return pathCmp;
    }
    return a.lineNumber - b.lineNumber;
}

function stepMatchesBinding(result: ResolveResult, binding: Binding): boolean {
    const best = result.candidates[0];
    if (!best) {
        return false;
    }
    if (sameBinding(best.binding, binding)) {
        return true;
    }
    if (result.status === 'ambiguous') {
        return result.candidates.some(c => sameBinding(c.binding, binding));
    }
    return false;
}

/**
 * All feature steps that use the given binding (same resolution rules as binding CodeLens).
 */
export function findReferencesForBinding(
    binding: Binding,
    allSteps: readonly FeatureStep[],
    resolve: ResolveStep
): FeatureStep[] {
    const matches: FeatureStep[] = [];
    for (const step of allSteps) {
        const result = resolve(step);
        if (stepMatchesBinding(result, binding)) {
            matches.push(step);
        }
    }
    return matches.sort(compareStepLocation);
}

/**
 * Other steps related to the source: same binding (if bound) and/or same normalized step text.
 */
export function findReferencesForStep(
    source: FeatureStep,
    allSteps: readonly FeatureStep[],
    resolve: ResolveStep
): StepReferenceMatch[] {
    const byKey = new Map<string, StepReferenceMatch>();
    const sourceResult = resolve(source);
    const sourceBinding = sourceResult.candidates[0]?.binding;

    const add = (step: FeatureStep, kind: StepReferenceKind): void => {
        const key = stepLocationKey(step);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, { step, kind });
            return;
        }
        if (existing.kind === 'same-text' && kind === 'same-binding') {
            byKey.set(key, { step, kind: 'same-binding' });
        }
    };

    add(source, sourceBinding ? 'same-binding' : 'same-text');

    for (const step of allSteps) {
        if (stepLocationKey(step) === stepLocationKey(source)) {
            continue;
        }

        const sameText =
            step.keywordResolved === source.keywordResolved &&
            step.normalizedText === source.normalizedText;

        if (sameText) {
            add(step, 'same-text');
            continue;
        }

        if (sourceBinding) {
            const result = resolve(step);
            if (stepMatchesBinding(result, sourceBinding)) {
                add(step, 'same-binding');
            }
        }
    }

    return Array.from(byKey.values()).sort((a, b) => compareStepLocation(a.step, b.step));
}
