/**
 * Explorer TreeView — workspace map holes (unbound / ambiguous / orphan).
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { FILE_WATCHER_DEBOUNCE_MS, ResolvedKeyword, MatchCandidate } from '../../core/domain';
import { createResolver, applyMatchingSettings, ResolverDependencies, ambiguityI18n, unboundI18n } from '../../core/matching';
import { collectAllIndexedSteps } from '../../core/references';
import {
    summarizeSuiteMap,
    isSuiteMapHealthy,
    groupHolesByUri,
    explainAmbiguousHole,
    explainUnboundHole,
    findHoleStep,
    type SuiteMapSummary,
    type SuiteMapStepHole,
    type SuiteMapOrphanHole,
    type SuiteMapFileGroup,
} from '../../core/map/suiteMap';
import { t } from '../../i18n';
import { navigateToLocation } from '../navigation/navigator';
import { showBindingQuickPick } from '../navigation/quickPick';
import {
    resolveUnboundMapAuthorAction,
    type AuthorStepRef,
} from '../author/bindingCodeActionsProvider';

export const SUITE_MAP_VIEW_ID = 'bddGuardian.suiteMap';
export const SUITE_MAP_FOCUS_COMMAND = 'bddGuardian.suiteMap.focus';
const OPEN_LOCATION_COMMAND = 'bddGuardian.suiteMap.openLocation';
const GENERATE_COMMAND = 'bddGuardian.suiteMap.generateBinding';
const COPY_COMMAND = 'bddGuardian.suiteMap.copySnippet';
const EXPLAIN_COMMAND = 'bddGuardian.suiteMap.explainAmbiguity';
const EXPLAIN_UNBOUND_COMMAND = 'bddGuardian.suiteMap.explainUnbound';

export function isSuiteMapEnabled(): boolean {
    return vscode.workspace.getConfiguration('bddGuardian.suiteMap').get<boolean>('enabled', true);
}

type SuiteMapGroupNode = {
    kind: 'group';
    group: 'unbound' | 'ambiguous' | 'orphans';
    summary: SuiteMapSummary;
};

type SuiteMapStepFileNode = {
    kind: 'file';
    group: 'unbound' | 'ambiguous';
    uri: SuiteMapStepHole['uri'];
    holes: readonly SuiteMapStepHole[];
    showRelativePath: boolean;
    parent: SuiteMapGroupNode;
};

type SuiteMapOrphanFileNode = {
    kind: 'file';
    group: 'orphans';
    uri: SuiteMapOrphanHole['uri'];
    holes: readonly SuiteMapOrphanHole[];
    showRelativePath: boolean;
    parent: SuiteMapGroupNode;
};

type SuiteMapFileNode = SuiteMapStepFileNode | SuiteMapOrphanFileNode;

type SuiteMapNode =
    | { kind: 'indexing' }
    | { kind: 'noFeatures' }
    | { kind: 'summary'; summary: SuiteMapSummary }
    | { kind: 'healthy' }
    | SuiteMapGroupNode
    | SuiteMapFileNode
    | { kind: 'step'; hole: SuiteMapStepHole; status: 'unbound' | 'ambiguous'; parent: SuiteMapStepFileNode }
    | { kind: 'orphan'; hole: SuiteMapOrphanHole; parent: SuiteMapOrphanFileNode }
    | { kind: 'more'; remaining: number; parent: SuiteMapGroupNode }
    | { kind: 'orphansSkipped'; parent: SuiteMapGroupNode };

function isIndexReady(index: ReturnType<IndexManager['getIndex']>): boolean {
    return index.getData().lastIndexed.getTime() > 0;
}

function displayLine(lineNumber: number): number {
    return lineNumber + 1;
}

function holeLineLabel(lineNumber: number, text: string): string {
    return `${displayLine(lineNumber)} — ${text}`;
}

function fileLabel(filePath: string, holeCount: number): string {
    return `${path.basename(filePath)} (${holeCount})`;
}

function showRelativePathForGroups<T extends { readonly uri: { readonly fsPath: string } }>(
    grouped: readonly SuiteMapFileGroup<T>[]
): boolean[] {
    const basenameCounts = new Map<string, number>();
    for (const g of grouped) {
        const base = path.basename(g.uri.fsPath);
        basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
    }
    return grouped.map((g) => {
        const base = path.basename(g.uri.fsPath);
        return grouped.length >= 2 || (basenameCounts.get(base) ?? 0) > 1;
    });
}

function toAuthorRef(hole: SuiteMapStepHole): AuthorStepRef {
    return { documentUri: hole.uri.toString(), line: hole.lineNumber };
}

export class SuiteMapTreeProvider implements vscode.TreeDataProvider<SuiteMapNode>, vscode.Disposable {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<SuiteMapNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly indexSub: vscode.Disposable;

    constructor(private readonly indexManager: IndexManager) {
        this.indexSub = indexManager.getIndex().onDidChange(() => this.scheduleRefresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    scheduleRefresh(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = undefined;
            this.refresh();
        }, FILE_WATCHER_DEBOUNCE_MS);
    }

    getTreeItem(element: SuiteMapNode): vscode.TreeItem {
        switch (element.kind) {
            case 'indexing':
                return this.leaf(t('suiteMapIndexing'), 'sync', 'suiteMap.indexing');
            case 'noFeatures':
                return this.leaf(t('suiteMapNoFeatures'), 'info', 'suiteMap.noFeatures');
            case 'healthy':
                return this.leaf(t('suiteMapHealthy'), 'check', 'suiteMap.healthy');
            case 'orphansSkipped':
                return this.leaf(t('suiteMapOrphansSkipped'), 'info', 'suiteMap.orphansSkipped');
            case 'more':
                return this.leaf(
                    t('suiteMapMore', String(element.remaining)),
                    'ellipsis',
                    `suiteMap.more.${element.parent.group}`
                );
            case 'summary': {
                const c = element.summary.counts;
                const item = new vscode.TreeItem(
                    t(
                        'suiteMapSummary',
                        String(c.bound),
                        String(c.unbound),
                        String(c.ambiguous),
                        String(c.orphanBindings)
                    ),
                    vscode.TreeItemCollapsibleState.None
                );
                item.id = 'suiteMap.summary';
                item.iconPath = new vscode.ThemeIcon('map');
                item.contextValue = 'suiteMapSummary';
                return item;
            }
            case 'group': {
                const label =
                    element.group === 'unbound'
                        ? t('suiteMapUnbound', String(element.summary.counts.unbound))
                        : element.group === 'ambiguous'
                          ? t('suiteMapAmbiguous', String(element.summary.counts.ambiguous))
                          : element.summary.orphansSkipped
                            ? t('suiteMapOrphansSkipped')
                            : t('suiteMapOrphans', String(element.summary.counts.orphanBindings));
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
                item.id = `suiteMap.group.${element.group}`;
                item.iconPath = new vscode.ThemeIcon(
                    element.group === 'unbound'
                        ? 'error'
                        : element.group === 'ambiguous'
                          ? 'warning'
                          : 'info'
                );
                item.contextValue = `suiteMapGroup.${element.group}`;
                return item;
            }
            case 'file': {
                const first = element.holes[0];
                const item = new vscode.TreeItem(
                    fileLabel(element.uri.fsPath, element.holes.length),
                    vscode.TreeItemCollapsibleState.Expanded
                );
                item.iconPath = new vscode.ThemeIcon('file');
                if (element.showRelativePath) {
                    item.description = vscode.workspace.asRelativePath(element.uri.fsPath, false);
                }
                if (first) {
                    item.command = {
                        command: OPEN_LOCATION_COMMAND,
                        title: t('suiteMapOpen'),
                        arguments: [element.uri.toString(), first.lineNumber],
                    };
                }
                item.id = `suiteMap.file.${element.group}.${element.uri.toString()}`;
                item.contextValue = `suiteMapFile.${element.group}`;
                return item;
            }
            case 'step': {
                const item = new vscode.TreeItem(
                    holeLineLabel(element.hole.lineNumber, element.hole.rawText),
                    vscode.TreeItemCollapsibleState.None
                );
                item.iconPath = new vscode.ThemeIcon(
                    element.status === 'unbound' ? 'error' : 'warning'
                );
                if (element.hole.matchCount !== undefined) {
                    item.description = String(element.hole.matchCount);
                }
                item.tooltip = element.hole.rawText;
                item.command = {
                    command: OPEN_LOCATION_COMMAND,
                    title: t('suiteMapOpen'),
                    arguments: [
                        element.hole.uri.toString(),
                        element.hole.lineNumber,
                        element.hole.rawText,
                    ],
                };
                item.id = `suiteMap.step.${element.status}.${element.hole.uri.toString()}:${element.hole.lineNumber}`;
                if (element.status === 'unbound') {
                    const action = resolveUnboundMapAuthorAction();
                    item.contextValue =
                        action === 'generate'
                            ? 'suiteMap.unbound.generate'
                            : action === 'copy'
                              ? 'suiteMap.unbound.copy'
                              : 'suiteMapHole.unbound';
                } else {
                    item.contextValue = 'suiteMap.ambiguous.explain';
                }
                return item;
            }
            case 'orphan': {
                const item = new vscode.TreeItem(
                    holeLineLabel(element.hole.lineNumber, element.hole.patternRaw),
                    vscode.TreeItemCollapsibleState.None
                );
                item.iconPath = new vscode.ThemeIcon('info');
                item.tooltip = element.hole.methodName;
                item.command = {
                    command: OPEN_LOCATION_COMMAND,
                    title: t('suiteMapOpen'),
                    arguments: [
                        element.hole.uri.toString(),
                        element.hole.lineNumber,
                        element.hole.methodName,
                    ],
                };
                item.id = `suiteMap.orphan.${element.hole.uri.toString()}:${element.hole.lineNumber}`;
                item.contextValue = 'suiteMapHole.orphan';
                return item;
            }
        }
    }

    getChildren(element?: SuiteMapNode): SuiteMapNode[] {
        if (!element) {
            return this.rootNodes();
        }
        if (element.kind === 'file') {
            if (element.group === 'orphans') {
                return element.holes.map((hole) => ({
                    kind: 'orphan' as const,
                    hole,
                    parent: element,
                }));
            }
            return element.holes.map((hole) => ({
                kind: 'step' as const,
                hole,
                status: element.group,
                parent: element,
            }));
        }
        if (element.kind !== 'group') {
            return [];
        }
        if (element.group === 'unbound') {
            const nodes: SuiteMapNode[] = this.stepFileNodes(element, element.summary.unbound, 'unbound');
            if (element.summary.unboundTruncated > 0) {
                nodes.push({
                    kind: 'more',
                    remaining: element.summary.unboundTruncated,
                    parent: element,
                });
            }
            return nodes;
        }
        if (element.group === 'ambiguous') {
            const nodes: SuiteMapNode[] = this.stepFileNodes(
                element,
                element.summary.ambiguous,
                'ambiguous'
            );
            if (element.summary.ambiguousTruncated > 0) {
                nodes.push({
                    kind: 'more',
                    remaining: element.summary.ambiguousTruncated,
                    parent: element,
                });
            }
            return nodes;
        }
        if (element.summary.orphansSkipped) {
            return [{ kind: 'orphansSkipped', parent: element }];
        }
        const nodes: SuiteMapNode[] = this.orphanFileNodes(element, element.summary.orphans);
        if (element.summary.orphansTruncated > 0) {
            nodes.push({
                kind: 'more',
                remaining: element.summary.orphansTruncated,
                parent: element,
            });
        }
        return nodes;
    }

    getParent(element: SuiteMapNode): SuiteMapNode | undefined {
        return 'parent' in element ? element.parent : undefined;
    }

    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.indexSub.dispose();
        this._onDidChangeTreeData.dispose();
    }

    private stepFileNodes(
        parent: SuiteMapGroupNode,
        holes: readonly SuiteMapStepHole[],
        group: 'unbound' | 'ambiguous'
    ): SuiteMapStepFileNode[] {
        const grouped = groupHolesByUri(holes);
        const showPath = showRelativePathForGroups(grouped);
        return grouped.map((g, i) => ({
            kind: 'file',
            group,
            uri: g.uri,
            holes: g.holes,
            showRelativePath: showPath[i],
            parent,
        }));
    }

    private orphanFileNodes(
        parent: SuiteMapGroupNode,
        holes: readonly SuiteMapOrphanHole[]
    ): SuiteMapOrphanFileNode[] {
        const grouped = groupHolesByUri(holes);
        const showPath = showRelativePathForGroups(grouped);
        return grouped.map((g, i) => ({
            kind: 'file',
            group: 'orphans',
            uri: g.uri,
            holes: g.holes,
            showRelativePath: showPath[i],
            parent,
        }));
    }

    private rootNodes(): SuiteMapNode[] {
        const index = this.indexManager.getIndex();
        if (!isIndexReady(index)) {
            return [{ kind: 'indexing' }];
        }
        const features = index.getAllFeatures();
        if (features.length === 0) {
            return [{ kind: 'noFeatures' }];
        }
        const summary = this.buildSummary();
        const roots: SuiteMapNode[] = [{ kind: 'summary', summary }];
        if (isSuiteMapHealthy(summary)) {
            roots.push({ kind: 'healthy' });
            return roots;
        }
        if (summary.counts.unbound > 0) {
            roots.push({ kind: 'group', group: 'unbound', summary });
        }
        if (summary.counts.ambiguous > 0) {
            roots.push({ kind: 'group', group: 'ambiguous', summary });
        }
        if (summary.orphansSkipped || summary.counts.orphanBindings > 0) {
            roots.push({ kind: 'group', group: 'orphans', summary });
        }
        return roots;
    }

    private buildSummary(): SuiteMapSummary {
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));
        return summarizeSuiteMap({
            steps: collectAllIndexedSteps(index),
            bindings: allBindings,
            resolve,
            featureCount: index.getAllFeatures().length,
        });
    }

    private leaf(label: string, iconId: string, id: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(iconId);
        item.id = id;
        return item;
    }
}

export function registerSuiteMap(
    context: vscode.ExtensionContext,
    indexManager: IndexManager
): { refresh: () => void } {
    const provider = new SuiteMapTreeProvider(indexManager);
    const treeView = vscode.window.createTreeView(SUITE_MAP_VIEW_ID, {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    context.subscriptions.push(
        provider,
        treeView,
        vscode.commands.registerCommand(SUITE_MAP_FOCUS_COMMAND, async () => {
            if (!isSuiteMapEnabled()) {
                vscode.window.showInformationMessage(t('suiteMapDisabled'));
                return;
            }
            await vscode.commands.executeCommand('workbench.view.explorer');
            const roots = provider.getChildren();
            if (roots[0]) {
                await treeView.reveal(roots[0], { expand: true, focus: true, select: true });
            }
        }),
        vscode.commands.registerCommand(
            OPEN_LOCATION_COMMAND,
            async (uriString: string, line: number, label?: string) => {
                await navigateToLocation(vscode.Uri.parse(uriString), line, label);
            }
        ),
        vscode.commands.registerCommand(GENERATE_COMMAND, async (node: SuiteMapNode) => {
            if (node?.kind !== 'step' || node.status !== 'unbound') {
                return;
            }
            await vscode.commands.executeCommand('bddGuardian.author.generateBinding', toAuthorRef(node.hole));
        }),
        vscode.commands.registerCommand(COPY_COMMAND, async (node: SuiteMapNode) => {
            if (node?.kind !== 'step' || node.status !== 'unbound') {
                return;
            }
            await vscode.commands.executeCommand('bddGuardian.author.copySnippet', toAuthorRef(node.hole));
        }),
        vscode.commands.registerCommand(EXPLAIN_COMMAND, async (node: SuiteMapNode) => {
            if (node?.kind !== 'step' || node.status !== 'ambiguous') {
                return;
            }
            const index = indexManager.getIndex();
            const allBindings = index.getAllBindings();
            const deps: ResolverDependencies = {
                getAllBindings: () => allBindings,
                getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
            };
            const resolve = createResolver(applyMatchingSettings(deps));
            const steps = collectAllIndexedSteps(index);
            const explanation = explainAmbiguousHole(node.hole, steps, resolve);
            if (!explanation) {
                vscode.window.showInformationMessage(t('suiteMapExplainStale'));
                return;
            }
            const step = findHoleStep(node.hole, steps);
            if (!step) {
                vscode.window.showInformationMessage(t('suiteMapExplainStale'));
                return;
            }
            const result = resolve(step);
            if (result.status !== 'ambiguous') {
                vscode.window.showInformationMessage(t('suiteMapExplainStale'));
                return;
            }
            const why = ambiguityI18n(explanation);
            await showBindingQuickPick(result, t(why.key, ...why.args));
        }),
        vscode.commands.registerCommand(EXPLAIN_UNBOUND_COMMAND, async (node: SuiteMapNode) => {
            if (node?.kind !== 'step' || node.status !== 'unbound') {
                return;
            }
            const index = indexManager.getIndex();
            const allBindings = index.getAllBindings();
            const deps: ResolverDependencies = {
                getAllBindings: () => allBindings,
                getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
            };
            const resolve = createResolver(applyMatchingSettings(deps));
            const steps = collectAllIndexedSteps(index);
            const explanation = explainUnboundHole(node.hole, steps, resolve, allBindings);
            if (!explanation) {
                vscode.window.showInformationMessage(t('suiteMapExplainUnboundStale'));
                return;
            }
            const step = findHoleStep(node.hole, steps);
            if (!step) {
                vscode.window.showInformationMessage(t('suiteMapExplainUnboundStale'));
                return;
            }
            const why = unboundI18n(explanation);
            const whyText = t(why.key, ...why.args);
            if (explanation.summaryKey === 'scopeExcluded' && explanation.outOfScopeMatches.length > 0) {
                const candidates: MatchCandidate[] = explanation.outOfScopeMatches.map((m) => ({
                    binding: m.binding,
                    score: 0,
                    keywordMatched: false,
                    matchedCandidate: step.rawText,
                }));
                await showBindingQuickPick(
                    { step, status: 'unbound', candidates },
                    whyText
                );
                return;
            }
            vscode.window.showInformationMessage(whyText);
        })
    );

    return { refresh: () => provider.refresh() };
}
