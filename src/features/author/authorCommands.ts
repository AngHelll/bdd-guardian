/**
 * Commands for binding author actions (copy / generate).
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { getProviderManager } from '../../providers/bindings';
import { t } from '../../i18n';
import {
    AuthorStepRef,
    buildAuthorSnippetText,
    resolveAuthorStepContext,
} from './bindingCodeActionsProvider';
import {
    buildCSharpNewFileContent,
    buildJsNewFileContent,
    defaultNewScaffoldPath,
    findCSharpBindingInsertLine,
    formatJsAppend,
    formatSnippetForInsert,
    getIndentForLine,
    pickScaffoldTargetPath,
    sanitizeMethodName,
    supportsScaffoldInsert,
} from './scaffoldInsert';
import { resolveHoverFrameworkContext, suggestBindingPattern } from '../hovers/bindingSnippets';
import {
    handoffOpenPilot,
    isPilotExtensionInstalled,
    isPilotHandoffEnabled,
    openPilotMarketplaceSearch,
    resolvePostGenerateToastButtons,
} from '../ecosystem';

export function registerAuthorCommands(context: vscode.ExtensionContext, indexManager: IndexManager): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bddGuardian.author.copySnippet',
            async (ref: AuthorStepRef) => copySnippet(ref)
        ),
        vscode.commands.registerCommand(
            'bddGuardian.author.copyPattern',
            async (ref: AuthorStepRef) => copyPattern(ref)
        ),
        vscode.commands.registerCommand(
            'bddGuardian.author.generateBinding',
            async (ref: AuthorStepRef) => generateBinding(ref, indexManager)
        ),
        vscode.commands.registerCommand('bddGuardian.pilot.open', async () => {
            await handoffOpenPilot();
        }),
        vscode.commands.registerCommand('bddGuardian.pilot.install', async () => {
            await openPilotMarketplaceSearch();
        })
    );
}

async function openFeatureDocument(uriString: string): Promise<vscode.TextDocument | null> {
    try {
        return await vscode.workspace.openTextDocument(vscode.Uri.parse(uriString));
    } catch {
        return null;
    }
}

async function copySnippet(ref: AuthorStepRef): Promise<void> {
    const doc = await openFeatureDocument(ref.documentUri);
    if (!doc) {
        return;
    }
    const ctx = resolveAuthorStepContext(doc, ref.line);
    if (!ctx) {
        return;
    }
    const text = buildAuthorSnippetText(ctx.stepText, ctx.keyword);
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(t('bindingSnippetCopied'));
}

async function copyPattern(ref: AuthorStepRef): Promise<void> {
    const doc = await openFeatureDocument(ref.documentUri);
    if (!doc) {
        return;
    }
    const ctx = resolveAuthorStepContext(doc, ref.line);
    if (!ctx) {
        return;
    }
    await vscode.env.clipboard.writeText(suggestBindingPattern(ctx.stepText));
    vscode.window.showInformationMessage(t('bindingPatternCopied'));
}

async function generateBinding(ref: AuthorStepRef, indexManager: IndexManager): Promise<void> {
    const doc = await openFeatureDocument(ref.documentUri);
    if (!doc) {
        return;
    }
    const ctx = resolveAuthorStepContext(doc, ref.line);
    if (!ctx) {
        return;
    }

    const selection = getProviderManager().getCachedSelection();
    const framework = resolveHoverFrameworkContext({ selection });
    if (!supportsScaffoldInsert(framework.snippetKind)) {
        vscode.window.showInformationMessage(t('bindingScaffoldNoTarget'));
        return;
    }

    const methodName = sanitizeMethodName(ctx.keyword, ctx.stepText);
    const snippetCode = buildAuthorSnippetText(ctx.stepText, ctx.keyword, methodName);

    const bindingPaths = [
        ...new Set(
            indexManager
                .getIndex()
                .getAllBindings()
                .map((b) => b.uri.fsPath)
        ),
    ];

    const targetPath = pickScaffoldTargetPath(framework.snippetKind, bindingPaths);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
        vscode.window.showInformationMessage(t('bindingScaffoldNoTarget'));
        return;
    }

    const edit = new vscode.WorkspaceEdit();

    if (targetPath) {
        const targetUri = vscode.Uri.file(targetPath);
        try {
            const targetDoc = await vscode.workspace.openTextDocument(targetUri);
            const content = targetDoc.getText();

            if (framework.snippetKind === 'js-cucumber') {
                const appendText = formatJsAppend(snippetCode, content);
                const pos = new vscode.Position(targetDoc.lineCount, 0);
                edit.insert(targetUri, pos, appendText);
            } else {
                const insertLine = findCSharpBindingInsertLine(content);
                if (insertLine === null) {
                    vscode.window.showInformationMessage(t('bindingScaffoldNoTarget'));
                    return;
                }
                const indent = getIndentForLine(content, insertLine);
                const insertText = formatSnippetForInsert(snippetCode, indent);
                edit.insert(targetUri, new vscode.Position(insertLine, 0), insertText);
            }

            await vscode.workspace.applyEdit(edit);
            const updated = await vscode.workspace.openTextDocument(targetUri);
            await vscode.window.showTextDocument(updated, { preview: false });
        } catch {
            await createNewScaffoldFile(edit, workspaceFolder, framework.snippetKind, snippetCode, methodName);
        }
    } else {
        await createNewScaffoldFile(edit, workspaceFolder, framework.snippetKind, snippetCode, methodName);
    }

    const reindexLabel = t('onboardingReindex');
    const pilotLabel = t('pilotHandoffRun');
    const { showPilotRun } = resolvePostGenerateToastButtons({
        handoffEnabled: isPilotHandoffEnabled(),
        pilotInstalled: isPilotExtensionInstalled(),
    });
    const buttons = showPilotRun ? [reindexLabel, pilotLabel] : [reindexLabel];
    void vscode.window.showInformationMessage(t('bindingScaffoldGenerated'), ...buttons).then((choice) => {
        if (choice === reindexLabel) {
            void vscode.commands.executeCommand('reqnrollNavigator.reindex');
        } else if (choice === pilotLabel) {
            void handoffOpenPilot();
        }
    });
}

async function createNewScaffoldFile(
    edit: vscode.WorkspaceEdit,
    workspaceFolder: vscode.WorkspaceFolder,
    snippetKind: ReturnType<typeof resolveHoverFrameworkContext>['snippetKind'],
    snippetCode: string,
    methodName: string
): Promise<void> {
    const relative = defaultNewScaffoldPath(snippetKind);
    if (!relative) {
        vscode.window.showInformationMessage(t('bindingScaffoldNoTarget'));
        return;
    }

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, relative);
    const content =
        snippetKind === 'js-cucumber'
            ? buildJsNewFileContent(snippetCode)
            : buildCSharpNewFileContent(
                  snippetCode,
                  snippetKind === 'csharp-specflow' ? 'csharp-specflow' : 'csharp-reqnroll'
              );

    edit.createFile(uri, { ignoreIfExists: false });
    edit.insert(uri, new vscode.Position(0, 0), content);
    await vscode.workspace.applyEdit(edit);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
}
