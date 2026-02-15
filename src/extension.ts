/**
 * BDD Guardian - VS Code Extension
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
    // Phase 2: Navigation History
    createNavigationHistoryCommands,
    createNavigationStatusBar,
    getNavigationHistory,
    copyDebugReportToClipboard,
    recordIndexDuration,
} from './features';
import { getProviderManager } from './providers/bindings';
import { BindingCodeLensProvider } from './providers/bindingCodeLensProvider';
import { ResolveResult, ResolvedKeyword } from './core/domain';
import { createResolver, ResolverDependencies } from './core/matching';
// Coach Mode
import {
    CoachDiagnosticsProvider,
    CoachQuickFixProvider,
    registerCoachCommands,
} from './features/coach';
import { t, refreshLanguage } from './i18n';

let indexManager: IndexManager;
let workspaceIndex: WorkspaceIndex;
let diagnosticsEngine: DiagnosticsEngine;
let decorationsManager: DecorationsManager;
let fileWatchers: FileWatchers;
let outputChannel: vscode.OutputChannel;
let codeLensProvider: ReturnType<typeof createCodeLensProvider>['provider'];
let bindingCodeLensProvider: BindingCodeLensProvider;
let navigationStatusBar: vscode.StatusBarItem;
let indexingStatusBarItem: vscode.StatusBarItem;
let coachDiagnosticsProvider: CoachDiagnosticsProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('BDD Guardian');
    outputChannel.appendLine(t('activation'));

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

    // Binding CodeLens (usages above step definitions) – multi-language
    bindingCodeLensProvider = new BindingCodeLensProvider(indexManager);
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [
                { language: 'csharp', scheme: 'file' },
                { language: 'typescript', scheme: 'file' },
                { language: 'javascript', scheme: 'file' },
                { language: 'python', scheme: 'file' },
                { language: 'go', scheme: 'file' },
            ],
            bindingCodeLensProvider
        )
    );

    // Indexing progress (status bar)
    indexingStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
    context.subscriptions.push(indexingStatusBarItem);

    // Phase 2: Register Navigation History commands
    const historyCommands = createNavigationHistoryCommands(context);
    historyCommands.forEach(cmd => context.subscriptions.push(cmd));
    
    // Phase 2: Create Navigation Status Bar
    navigationStatusBar = createNavigationStatusBar();
    context.subscriptions.push(navigationStatusBar);

    // Coach Mode: Register diagnostics and quick fixes
    coachDiagnosticsProvider = new CoachDiagnosticsProvider();
    context.subscriptions.push(coachDiagnosticsProvider);
    
    // Coach Mode: Register code actions provider (quick fixes)
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { language: 'gherkin', scheme: 'file' },
            new CoachQuickFixProvider(),
            { providedCodeActionKinds: CoachQuickFixProvider.providedCodeActionKinds }
        )
    );
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { language: 'feature', scheme: 'file' },
            new CoachQuickFixProvider(),
            { providedCodeActionKinds: CoachQuickFixProvider.providedCodeActionKinds }
        )
    );
    
    // Coach Mode: Register commands
    registerCoachCommands(context);

    registerCommands(context);
    registerEventHandlers(context);

    context.subscriptions.push(
        outputChannel, 
        diagnosticsEngine, 
        decorationsManager, 
        fileWatchers,
        getNavigationHistory()
    );

    await performInitialIndexing();
    fileWatchers.start();

    if (vscode.window.activeTextEditor) {
        decorationsManager.updateDecorations(vscode.window.activeTextEditor);
    }

    outputChannel.appendLine(t('activated'));
    vscode.window.showInformationMessage(t('ready'));
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('reqnrollNavigator.reindex', async () => {
            await performInitialIndexing();
            refreshAllUI();
            vscode.window.showInformationMessage(t('reindexComplete'));
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('reqnrollNavigator.showBindings', async () => {
            const bindings = workspaceIndex.getAllBindings();
            if (bindings.length === 0) {
                vscode.window.showInformationMessage(t('noBindingsFound'));
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
                vscode.window.showWarningMessage(t('noBindingFound'));
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
        vscode.commands.registerCommand('reqnroll-navigator.showProviderReport', showProviderDetectionReport),
        vscode.commands.registerCommand('bddGuardian.copyDebugReport', copyDebugReport),
        vscode.commands.registerCommand('reqnrollNavigator.goToStepUsage', goToStepUsage),
        vscode.commands.registerCommand('reqnrollNavigator.showBindingUsages', showBindingUsages),
        vscode.commands.registerCommand('reqnrollNavigator.showAmbiguousMatches', showAmbiguousMatches)
    );
}

async function showAmbiguousMatches(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.feature')) {
        vscode.window.showInformationMessage(t('noBindingFound'));
        return;
    }
    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line).text;
    const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i);
    if (!stepMatch) {
        vscode.window.showInformationMessage(t('noBindingFound'));
        return;
    }
    const keyword = stepMatch[1];
    const text = stepMatch[2].trim();
    const index = indexManager.getIndex();
    const allBindings = index.getAllBindings();
    if (allBindings.length === 0) {
        vscode.window.showInformationMessage(t('noBindingsFound'));
        return;
    }
    const resolvedKeyword = (kw: string): ResolvedKeyword => {
        const lower = kw.toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
        return 'Given';
    };
    const deps: ResolverDependencies = {
        getAllBindings: () => allBindings,
        getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
    };
    const resolve = createResolver(deps);
    const step = {
        keywordOriginal: keyword as 'Given' | 'When' | 'Then' | 'And' | 'But',
        keywordResolved: resolvedKeyword(keyword),
        rawText: text,
        normalizedText: text.replace(/\s+/g, ' ').trim(),
        fullText: line.trim(),
        tagsEffective: [] as string[],
        uri: document.uri,
        range: new vscode.Range(position.line, 0, position.line, line.length),
        lineNumber: position.line,
        isOutline: false,
        candidateTexts: [text],
    };
    const result = resolve(step as any);
    if (result.candidates.length <= 1) {
        vscode.window.showInformationMessage(t('noBindingFound'));
        return;
    }
    await showBindingQuickPick(result);
}

interface StepUsagePayload {
    uri: string;
    lineNumber: number;
}

interface BindingUsagePayload {
    uri: string;
    lineNumber: number;
    scenarioName?: string;
    rawText?: string;
}

async function goToStepUsage(payload: StepUsagePayload): Promise<void> {
    if (!payload?.uri) return;
    const uri = typeof payload.uri === 'string' ? vscode.Uri.parse(payload.uri) : payload.uri;
    const line = Number(payload.lineNumber) ?? 0;
    await vscode.window.showTextDocument(uri, {
        selection: new vscode.Range(line, 0, line, 0),
        preview: false,
    });
}

async function showBindingUsages(
    _bindingRef: StepUsagePayload,
    usages: BindingUsagePayload[]
): Promise<void> {
    if (!usages?.length) return;
    const items = usages.map((u) => ({
        label: (u.rawText ?? 'step').slice(0, 60) + (u.rawText && u.rawText.length > 60 ? '…' : ''),
        description: u.scenarioName ?? 'Unknown',
        detail: vscode.workspace.asRelativePath(u.uri),
        uri: u.uri,
        lineNumber: u.lineNumber,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: t('selectUsagePlaceholder'),
        matchOnDescription: true,
        matchOnDetail: true,
    });
    if (picked) {
        await vscode.window.showTextDocument(vscode.Uri.parse(picked.uri), {
            selection: new vscode.Range(picked.lineNumber, 0, picked.lineNumber, 0),
            preview: false,
        });
    }
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
                bindingCodeLensProvider.refresh();
                updateAllDiagnostics();
            }
            if (e.affectsConfiguration('bddGuardian.displayLanguage')) {
                refreshLanguage();
            }
        })
    );
}

async function performInitialIndexing(): Promise<void> {
    const config = getConfig();
    getProviderManager().updateConfig({ debug: config.debug });
    indexingStatusBarItem.text = '$(loading~spin) ' + t('statusIndexing');
    indexingStatusBarItem.show();
    try {
        await indexManager.indexAll(config);
        updateAllDiagnostics();
        indexingStatusBarItem.text = '$(check) ' + t('statusReady');
        indexingStatusBarItem.show();
        setTimeout(() => { indexingStatusBarItem.text = ''; indexingStatusBarItem.hide(); }, 2500);
    } catch {
        indexingStatusBarItem.text = '$(warning) ' + t('statusIndexingFailed');
        indexingStatusBarItem.show();
        setTimeout(() => { indexingStatusBarItem.text = ''; indexingStatusBarItem.hide(); }, 3000);
    }
}

function updateAllDiagnostics(): void {
    vscode.workspace.textDocuments.forEach((doc) => {
        if (isFeatureFile(doc)) diagnosticsEngine.analyzeFile(doc);
    });
}

function refreshAllUI(): void {
    codeLensProvider.refresh();
    bindingCodeLensProvider.refresh();
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
    
    const msg = t('statsMessage', String(stats.featureCount), String(stats.stepCount), String(stats.bindingCount));
    outputChannel.appendLine(msg);
    outputChannel.show();
    vscode.window.showInformationMessage(msg);
}

async function copyDebugReport(): Promise<void> {
    const pm = getProviderManager();
    await copyDebugReportToClipboard(workspaceIndex, pm);
}
function showProviderDetectionReport(): void {
    const pm = getProviderManager();
    outputChannel.appendLine(pm.getDetectionReportString());
    outputChannel.show();
    const sel = pm.getCachedSelection();
    if (sel) {
        vscode.window.showInformationMessage(t('activeProviders', sel.active.map(p => p.displayName).join(', ') || 'None'));
    }
}

export function deactivate(): void {
    fileWatchers?.dispose();
    diagnosticsEngine?.dispose();
    decorationsManager?.dispose();
    navigationStatusBar?.dispose();
    indexingStatusBarItem?.dispose();
    coachDiagnosticsProvider?.dispose();
}
