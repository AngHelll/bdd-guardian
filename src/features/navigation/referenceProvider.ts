/**
 * Reference Provider — Shift+F12 for feature steps and step bindings.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, applyMatchingSettings, ResolverDependencies } from '../../core/matching';
import {
    collectAllIndexedSteps,
    findReferencesForBinding,
    findReferencesForStep,
    findBindingAtLine,
    getBindingsForUri,
    getStepAtPosition,
    isFeatureDocument,
    stepLocationKey,
    type StepReferenceMatch,
} from '../../core/references';
import { REFERENCE_DOCUMENT_SELECTORS } from './documentSelectors';

export class ReferenceProvider implements vscode.ReferenceProvider {
    constructor(private readonly indexManager: IndexManager) {}

    provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        _token: vscode.CancellationToken
    ): vscode.Location[] {
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        if (allBindings.length === 0) {
            return [];
        }

        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: kw => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));
        const allSteps = collectAllIndexedSteps(index);

        if (isFeatureDocument(document)) {
            return this.referencesForFeatureStep(document, position, allSteps, resolve, context);
        }

        const fileBindings = getBindingsForUri(allBindings, document.uri);
        if (fileBindings.length === 0) {
            return [];
        }

        return this.referencesForBinding(document, position, fileBindings, allSteps, resolve, context);
    }

    private referencesForFeatureStep(
        document: vscode.TextDocument,
        position: vscode.Position,
        allSteps: ReturnType<typeof collectAllIndexedSteps>,
        resolve: ReturnType<typeof createResolver>,
        context: vscode.ReferenceContext
    ): vscode.Location[] {
        const source = getStepAtPosition(document, position);
        if (!source) {
            return [];
        }

        const matches = findReferencesForStep(source, allSteps, resolve);
        return this.stepMatchesToLocations(matches, context, stepLocationKey(source));
    }

    private referencesForBinding(
        document: vscode.TextDocument,
        position: vscode.Position,
        fileBindings: ReturnType<typeof getBindingsForUri>,
        allSteps: ReturnType<typeof collectAllIndexedSteps>,
        resolve: ReturnType<typeof createResolver>,
        context: vscode.ReferenceContext
    ): vscode.Location[] {
        const binding = findBindingAtLine(fileBindings, position.line);
        if (!binding) {
            return [];
        }

        const stepUsages = findReferencesForBinding(binding, allSteps, resolve);
        const locations: vscode.Location[] = [
            new vscode.Location(binding.uri, binding.range.start),
        ];

        for (const step of stepUsages) {
            locations.push(new vscode.Location(step.uri, step.range.start));
        }

        if (!context.includeDeclaration) {
            return locations.filter(
                loc =>
                    !(
                        loc.uri.toString() === binding.uri.toString() &&
                        loc.range.start.line === binding.lineNumber
                    )
            );
        }

        return locations;
    }

    private stepMatchesToLocations(
        matches: StepReferenceMatch[],
        context: vscode.ReferenceContext,
        sourceKey: string
    ): vscode.Location[] {
        return matches
            .filter(m => context.includeDeclaration || stepLocationKey(m.step) !== sourceKey)
            .map(m => new vscode.Location(m.step.uri, m.step.range.start));
    }
}

export function createReferenceProvider(indexManager: IndexManager): vscode.Disposable {
    const provider = new ReferenceProvider(indexManager);
    return vscode.languages.registerReferenceProvider(REFERENCE_DOCUMENT_SELECTORS, provider);
}
