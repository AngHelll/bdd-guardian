/**
 * Reqnroll Navigator - VS Code Extension
 */

import * as vscode from 'vscode';
import { WorkspaceIndex, IndexManager, FileWatchers } from './core/index';
import { getConfig, invalidateConfigCache } from './config';
import {
    createDefinitionProvider,
    createCodeLensProvider,
    createHoverProvider,
    DiagnosticsEngine,
    DecorationsManager,
    showBindingQuickPick,
    navigateToBinding,
} from './features';
import { getProviderManager } from './providers/bindings';
import { ResolveResult } from './core/domain';

let indexManager: IndexManager;
let workspaceIndex: WorkspaceIndex;
let diagnosticsEngine: DiagnosticsEngine;
let decorationsManager: DecorationsManager;
let fileWatchers: FileWatchers;
let outputChannel: vscode.OutputChannel;
let codeLensProvider: ReturnType<typeof createCodeLensProvider>['provider'];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('Reqnroll Navigator');
    outputChannel.appendLine('Reqnroll Navigator is activating...');

    workspaceIndex = new WorkspaceIndex();
    indexManager = new IndexManager(workspaceIndex, outputChannel);
    diagnosticsEngine = new DiagnosticsEngine(indexManager);
    decorationsManager = new DecorationsManager(indexManager);

    fileWatchers = new FileWatchers(
        indexManager,
        getConfig(),
        () => { refreshAllUI(); },
        () => { refreshAllUI(); }
    );

    context.subscriptions.push(createDefinitionProvider(indexManager));
    context.subscriptions.push(createHoverProvider(indexManager));
    
    const codeLensResult = createCodeLensProvider(indexManager);
    codeLensProvider = codeLensResult.provider;
    context.subscriptions.push(codeLensResult.disposable);

    registerCommands(context);
    registerEventHandlers(context);

    context.subscriptions.push(outputChannel, diagnosticsEngine, decorationsManager, fileWatchers);

    await performInitialIndexing();
    fileWatchers.start();

    if (vscode.window.activeTextEditor) {
        decorationsManager.updateDecorations(vscode.window.activeTextEditor);
    }

    outputChannel.appendLine('Reqnroll Navigator activated!');
    vscode.window.showInformationMessage('Reqnroll Navigator is ready!');
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('reqnrollNavigator.reindex', async () => {
            await performInitialIndexing();
            refreshAllUI();
            vscode.window.showInformationMessage('Reindex complete!');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('reqnrollNavigator.showBindings', async () => {
            const bindings = workspaceIndex.getAllBindings();
            if (bindings.length === 0) {
                vscode.window.showInformationMessage('No bindings found.');
                return;
            }
            const items = bindings.map(b => ({
                label: '[' + b.keyword + '] ' + b.methodName,
                description: b.patternRaw,
                detail: b.className + ' - ' + vscode.workspace.asRelativePath(b.uri),
                binding: b,
            }));
            const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select binding' });
            if (selected) {
                await vscode.commands.executeCommand('vscode.open', selected.binding.uri, {
                    selection: new vscode.Range(selected.binding.lineNumber, 0, selected.binding.lineNumber, 0),
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('reqnroll-navigator.goToStep', async (result: ResolveResult) => {
            if (!result || result.candidates.length === 0) {
                vscode.window.showWarningMessage('No binding found');
                return;
            }
            if (result.candidates.length === 1) {
                await navigateToBinding(result.candidates[0]);
            } else {
                await showBindingQuickPick(result);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('reqnroll-navigator.showStatistics', showStatistics),
        vscode.commands.registerCommand('reqnrollNavigator.showStatistics', showStatistics),
        vscode.commands.registerCommand('reqnroll-navigator.showProviderReport', showProviderDetectionReport)
    );
}

function registerEventHandlers(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (isFeatureFile(doc)) {
                await indexManager.indexFeatureFile(doc.uri);
                codeLensProvider.refresh();
                diagnosticsEngine.analyzeFile(doc);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && isFeatureFile(editor.document)) {
                decorationsManager.updateDecorations(editor);
            }
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('reqnrollNavigator')) {
                invalidateConfigCache();
                codeLensProvider.refresh();
                updateAllDiagnostics();
            }
        })
    );
}

async function performInitialIndexing(): Promise<void> {
    const config = getConfig();
    getProviderManager().updateConfig({ debug: config.debug });
    await indexManager.indexAll(config);
    updateAllDiagnostics();
}

function updateAllDiagnostics(): void {
    vscode.workspace.textDocuments.forEach((doc) => {
        if (isFeatureFile(doc)) diagnosticsEngine.analyzeFile(doc);
    });
}

function refreshAllUI(): void {
    codeLensProvider.refresh();
    updateAllDiagnostics();
    if (vscode.window.activeTextEditor) {
        decorationsManager.updateDecorations(vscode.window.activeTextEditor);
    }
}

function isFeatureFile(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'gherkin' || doc.fileName.endsWith('.feature');
}

function showStatistics(): void {
    const stats = workspaceIndex.getStats();
    const bindings = workspaceIndex.getAllBindings();
    const kw = { Given: 0, When: 0, Then: 0 };
    bindings.forEach((b) => { if (b.keyword in kw) kw[b.keyword as keyof typeof kw]++; });
    
    const msg = 'Features: ' + stats.featureCount + ', Steps: ' + stats.stepCount + ', Bindings: ' + stats.bindingCount;
    outputChannel.appendLine(msg);
    outputChannel.show();
    vscode.window.showInformationMessage(msg);
}

function showProviderDetectionReport(): void {
    const pm = getProviderManager();
    outputChannel.appendLine(pm.getDetectionReportString());
    outputChannel.show();
    const sel = pm.getCachedSelection();
    if (sel) {
        vscode.window.showInformationMessage('Active: ' + (sel.active.map(p => p.displayName).join(', ') || 'None'));
    }
}

export function deactivate(): void {
    fileWatchers?.dispose();
    diagnosticsEngine?.dispose();
    decorationsManager?.dispose();
}
