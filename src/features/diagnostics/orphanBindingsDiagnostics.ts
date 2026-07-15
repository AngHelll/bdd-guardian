/**
 * Orphan / unused binding diagnostics — Problems panel on binding files.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, applyMatchingSettings, ResolverDependencies } from '../../core/matching';
import {
    BINDINGS_DIAGNOSTIC_SOURCE,
    MAX_ORPHAN_BINDING_SCAN,
    ORPHAN_BINDING_DIAGNOSTIC_CODE,
    ResolvedKeyword,
} from '../../core/domain';
import {
    collectAllIndexedSteps,
    listOrphanBindings,
} from '../../core/references';
import { t } from '../../i18n';

export function isOrphanBindingsEnabled(): boolean {
    return vscode.workspace
        .getConfiguration('bddGuardian.orphanBindings')
        .get<boolean>('enabled', true);
}

export class OrphanBindingsDiagnostics implements vscode.Disposable {
    private readonly collection: vscode.DiagnosticCollection;
    /** URIs that currently have orphan diagnostics (for cleanup). */
    private trackedUris = new Set<string>();

    constructor(
        private readonly indexManager: IndexManager,
        private readonly outputChannel?: vscode.OutputChannel
    ) {
        this.collection = vscode.languages.createDiagnosticCollection(
            'BDD Guardian Orphan Bindings'
        );
    }

    refresh(): void {
        if (!isOrphanBindingsEnabled()) {
            this.clear();
            return;
        }

        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();

        if (allBindings.length === 0) {
            this.clear();
            return;
        }

        if (allBindings.length > MAX_ORPHAN_BINDING_SCAN) {
            this.outputChannel?.appendLine(
                `[orphanBindings] skipped: ${allBindings.length} bindings > ${MAX_ORPHAN_BINDING_SCAN}`
            );
            this.clear();
            return;
        }

        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));
        const allSteps = collectAllIndexedSteps(index);
        const orphans = listOrphanBindings(allBindings, allSteps, resolve);

        const byUri = new Map<string, vscode.Diagnostic[]>();
        for (const binding of orphans) {
            const key = binding.uri.toString();
            const list = byUri.get(key) ?? [];
            const diagnostic = new vscode.Diagnostic(
                binding.range,
                t('diagnosticOrphanBinding', binding.methodName),
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.source = BINDINGS_DIAGNOSTIC_SOURCE;
            diagnostic.code = ORPHAN_BINDING_DIAGNOSTIC_CODE;
            list.push(diagnostic);
            byUri.set(key, list);
        }

        const nextKeys = new Set(byUri.keys());
        for (const prev of this.trackedUris) {
            if (!nextKeys.has(prev)) {
                this.collection.delete(vscode.Uri.parse(prev));
            }
        }
        for (const [key, diags] of byUri) {
            this.collection.set(vscode.Uri.parse(key), diags);
        }
        this.trackedUris = nextKeys;
    }

    clear(): void {
        this.collection.clear();
        this.trackedUris.clear();
    }

    dispose(): void {
        this.collection.dispose();
        this.trackedUris.clear();
    }
}
