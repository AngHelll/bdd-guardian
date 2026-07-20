/**
 * Code actions for unbound steps: copy snippet/pattern and generate binding scaffold.
 */

import * as vscode from 'vscode';
import { getStepAtPosition } from '../../core/references/stepContext';
import { getProviderManager } from '../../providers/bindings';
import {
    buildUnboundBindingSnippet,
    resolveHoverFrameworkContext,
    suggestBindingPattern,
} from '../hovers/bindingSnippets';
import { t } from '../../i18n';
import {
    isUnboundBindingDiagnostic,
    supportsScaffoldInsert,
} from './scaffoldInsert';
import {
    isPilotExtensionInstalled,
    isPilotHandoffEnabled,
    resolvePilotHandoffAction,
} from '../ecosystem';

export { isUnboundBindingDiagnostic } from './scaffoldInsert';

export class BindingCodeActionsProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Source,
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        if (!isAuthorActionsEnabled()) {
            return [];
        }

        const unboundDiagnostics = context.diagnostics.filter(isUnboundBindingDiagnostic);
        if (unboundDiagnostics.length === 0) {
            return [];
        }

        const actions: vscode.CodeAction[] = [];
        const diagnostic = unboundDiagnostics[0];
        const line = diagnostic.range.start.line;
        const args = { documentUri: document.uri.toString(), line };

        const copySnippet = new vscode.CodeAction(
            t('codeActionCopySnippet'),
            vscode.CodeActionKind.QuickFix
        );
        copySnippet.command = {
            command: 'bddGuardian.author.copySnippet',
            title: t('codeActionCopySnippet'),
            arguments: [args],
        };
        copySnippet.isPreferred = true;
        actions.push(copySnippet);

        const copyPattern = new vscode.CodeAction(
            t('codeActionCopyPattern'),
            vscode.CodeActionKind.QuickFix
        );
        copyPattern.command = {
            command: 'bddGuardian.author.copyPattern',
            title: t('codeActionCopyPattern'),
            arguments: [args],
        };
        actions.push(copyPattern);

        const selection = getProviderManager().getCachedSelection();
        const framework = resolveHoverFrameworkContext({ selection });
        if (supportsScaffoldInsert(framework.snippetKind)) {
            const generate = new vscode.CodeAction(
                t('codeActionGenerateBinding'),
                vscode.CodeActionKind.QuickFix
            );
            generate.command = {
                command: 'bddGuardian.author.generateBinding',
                title: t('codeActionGenerateBinding'),
                arguments: [args],
            };
            actions.push(generate);
        }

        const handoff = resolvePilotHandoffAction({
            handoffEnabled: isPilotHandoffEnabled(),
            pilotInstalled: isPilotExtensionInstalled(),
        });
        if (handoff === 'open') {
            const openPilot = new vscode.CodeAction(
                t('codeActionOpenPilot'),
                vscode.CodeActionKind.QuickFix
            );
            openPilot.command = {
                command: 'bddGuardian.pilot.open',
                title: t('codeActionOpenPilot'),
            };
            actions.push(openPilot);
        } else if (handoff === 'install') {
            const installPilot = new vscode.CodeAction(
                t('codeActionInstallPilot'),
                vscode.CodeActionKind.QuickFix
            );
            installPilot.command = {
                command: 'bddGuardian.pilot.install',
                title: t('codeActionInstallPilot'),
            };
            actions.push(installPilot);
        }

        return actions;
    }
}

export function isAuthorActionsEnabled(): boolean {
    return vscode.workspace.getConfiguration('bddGuardian.authorActions').get<boolean>('enabled', true);
}

export interface AuthorStepRef {
    documentUri: string;
    line: number;
}

export function resolveAuthorStepContext(
    document: vscode.TextDocument,
    line: number
): { stepText: string; keyword: import('../../core/domain').ResolvedKeyword } | null {
    const step = getStepAtPosition(document, new vscode.Position(line, 0));
    if (!step) {
        return null;
    }
    return { stepText: step.rawText, keyword: step.keywordResolved };
}

export function buildAuthorSnippetText(
    stepText: string,
    keyword: import('../../core/domain').ResolvedKeyword,
    methodName?: string
): string {
    const selection = getProviderManager().getCachedSelection();
    const framework = resolveHoverFrameworkContext({ selection });
    const pattern = suggestBindingPattern(stepText);
    const snippet = buildUnboundBindingSnippet(framework.snippetKind, keyword, pattern);
    if (methodName && snippet.code.includes('public void Step()')) {
        return snippet.code.replace('public void Step()', `public void ${methodName}()`);
    }
    if (methodName && snippet.code.includes('public void stepDefinition()')) {
        return snippet.code.replace(
            'public void stepDefinition()',
            `public void ${methodName}()`
        );
    }
    if (methodName && snippet.code.includes('def step_definition(context)')) {
        return snippet.code.replace(
            'def step_definition(context)',
            `def ${methodName}(context)`
        );
    }
    if (methodName && snippet.code.includes('function ()')) {
        return snippet.code.replace('function ()', `function ${methodName}()`);
    }
    return snippet.code;
}
