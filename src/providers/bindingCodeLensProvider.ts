/**
 * Binding CodeLens Provider
 * Shows usage counts above step bindings in any indexed binding file (C#, TypeScript, Python, etc.)
 *
 * Multi-framework: uses WorkspaceIndex + Resolver from core, so it works for every
 * provider that has indexed bindings (Reqnroll, SpecFlow, Cucumber.js, Behave, etc.)
 */

import * as vscode from 'vscode';
import { IndexManager } from '../core/index';
import { createResolver, ResolverDependencies } from '../core/matching';
import type { Binding, FeatureStep, ResolvedKeyword, ResolveResult } from '../core/domain/types';
import { getConfig } from '../config';
import { t } from '../i18n';

/**
 * CodeLens provider for binding files (any language indexed by a BDD provider).
 * Shows how many scenarios use each binding; click to navigate to step usages.
 */
export class BindingCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    constructor(private indexManager: IndexManager) {}

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const config = getConfig();
        if (!config.enableCodeLens) {
            return [];
        }

        const index = this.indexManager.getIndex();
        const bindingDoc = index.getBindingFileByUri(document.uri);
        if (!bindingDoc || bindingDoc.bindings.length === 0) {
            return [];
        }

        const allBindings = index.getAllBindings();
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(deps);

        const allSteps = this.getAllStepsFromIndex(index);
        const codeLenses: vscode.CodeLens[] = [];

        for (const binding of bindingDoc.bindings) {
            const usages = this.findBindingUsages(binding, allSteps, resolve);
            const lens = this.createReferenceLens(binding, usages);
            codeLenses.push(lens);
        }

        return codeLenses;
    }

    resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken): vscode.CodeLens {
        return codeLens;
    }

    private getAllStepsFromIndex(index: ReturnType<IndexManager['getIndex']>): FeatureStep[] {
        const steps: FeatureStep[] = [];
        for (const feature of index.getAllFeatures()) {
            steps.push(...feature.allSteps);
        }
        return steps;
    }

    private findBindingUsages(
        binding: Binding,
        allSteps: FeatureStep[],
        resolve: (step: FeatureStep) => ResolveResult
    ): FeatureStep[] {
        const usages: FeatureStep[] = [];
        for (const step of allSteps) {
            const result = resolve(step);
            const best = result.candidates[0];
            if (!best) continue;
            if (this.sameBinding(best.binding, binding)) {
                usages.push(step);
            } else if (result.status === 'ambiguous') {
                const isMatch = result.candidates.some((c) => this.sameBinding(c.binding, binding));
                if (isMatch) usages.push(step);
            }
        }
        return usages;
    }

    private sameBinding(a: Binding, b: Binding): boolean {
        return a.uri.toString() === b.uri.toString() && a.lineNumber === b.lineNumber;
    }

    private createReferenceLens(binding: Binding, usages: FeatureStep[]): vscode.CodeLens {
        const count = usages.length;
        const uniqueScenarios = this.getUniqueScenarios(usages);
        const range = new vscode.Range(binding.lineNumber, 0, binding.lineNumber, 0);

        if (count === 0) {
            return new vscode.CodeLens(range, {
                title: '○ ' + t('bindingUsagesNoUsages'),
                command: '',
                tooltip: t('bindingUsagesNoUsages'),
            });
        }

        const serializedUsages = usages.map((s) => ({
            uri: s.uri.toString(),
            lineNumber: s.lineNumber,
            scenarioName: s.scenarioName,
            rawText: s.rawText,
        }));

        if (count === 1) {
            const u = serializedUsages[0];
            const scenarioLabel = u.scenarioName ?? t('bindingUsagesUnknown');
            return new vscode.CodeLens(range, {
                title: `→ ${t('bindingUsagesOneUsage')} (${scenarioLabel})`,
                command: 'reqnrollNavigator.goToStepUsage',
                arguments: [{ uri: u.uri, lineNumber: u.lineNumber }],
                tooltip: t('bindingUsagesUsedIn', scenarioLabel),
            });
        }

        return new vscode.CodeLens(range, {
            title: `→ ${t('bindingUsagesNUsages', String(count))} (${t('bindingUsagesScenarios', String(uniqueScenarios))})`,
            command: 'reqnrollNavigator.showBindingUsages',
            arguments: [
                { uri: binding.uri.toString(), lineNumber: binding.lineNumber },
                serializedUsages,
            ],
            tooltip: t('bindingUsagesClickToSee', String(count), String(uniqueScenarios)),
        });
    }

    private getUniqueScenarios(usages: FeatureStep[]): number {
        const set = new Set<string>();
        for (const u of usages) {
            set.add(`${u.uri.toString()}:${u.scenarioName ?? 'unknown'}`);
        }
        return set.size;
    }
}
