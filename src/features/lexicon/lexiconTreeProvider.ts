/**
 * Explorer TreeView — one row per lexicon phrase.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import type { LexiconDialect, LexiconImplementation, LexiconSpeaker } from '../../core/lexicon/lexicon';
import { t } from '../../i18n';
import { navigateToLocation } from '../navigation/navigator';
import { formatLexiconSummary, formatLexiconUsageCount, formatLexiconWordDescription } from './lexiconLabels';
import { isLexiconEnabled, type LexiconSnapshot } from './lexiconSnapshot';

export const LEXICON_VIEW_ID = 'bddGuardian.lexicon';
export const LEXICON_FOCUS_COMMAND = 'bddGuardian.lexicon.focus';
export const LEXICON_REVEAL_COMMAND = 'bddGuardian.lexicon.reveal';
const OPEN_LOCATION_COMMAND = 'bddGuardian.lexicon.openLocation';

type WordNode = {
    kind: 'word';
    key: string;
    label: string;
    description: string;
};

type LexiconNode =
    | { kind: 'indexing' }
    | { kind: 'empty' }
    | { kind: 'summary'; label: string }
    | { kind: 'more'; remaining: number }
    | WordNode
    | { kind: 'usage'; speaker: LexiconSpeaker; parent: WordNode }
    | { kind: 'implementation'; impl: LexiconImplementation; parent: WordNode }
    | { kind: 'dialect'; dialect: LexiconDialect; parent: WordNode };

export class LexiconTreeProvider implements vscode.TreeDataProvider<LexiconNode>, vscode.Disposable {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<LexiconNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private readonly snapshotSub: vscode.Disposable;
    private roots: LexiconNode[] = [];
    private readonly words = new Map<string, WordNode>();
    private readonly children = new Map<string, LexiconNode[]>();

    constructor(private readonly snapshot: LexiconSnapshot) {
        this.snapshotSub = snapshot.onDidChange(() => this.refresh());
    }

    dispose(): void {
        this.snapshotSub.dispose();
        this._onDidChangeTreeData.dispose();
    }

    refresh(): void {
        this.rebuild();
        this._onDidChangeTreeData.fire(undefined);
    }

    findWord(key: string): WordNode | undefined {
        this.rebuild();
        return this.words.get(key);
    }

    getTreeItem(element: LexiconNode): vscode.TreeItem {
        switch (element.kind) {
            case 'indexing':
                return this.leaf(t('lexiconIndexing'), 'sync', 'lexicon.indexing');
            case 'empty':
                return this.leaf(t('lexiconNoBindings'), 'info', 'lexicon.empty');
            case 'summary': {
                const item = this.leaf(element.label, 'book', 'lexicon.summary');
                item.contextValue = 'lexiconSummary';
                return item;
            }
            case 'more':
                return this.leaf(t('lexiconMore', String(element.remaining)), 'ellipsis', `lexicon.more`);
            case 'word': {
                const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
                item.description = element.description;
                item.iconPath = new vscode.ThemeIcon('symbol-key');
                item.id = `lexicon.word.${encodeURIComponent(element.key)}`;
                item.contextValue = 'lexiconWord';
                return item;
            }
            case 'usage': {
                const item = this.leaf(element.speaker.text, 'references', this.usageId(element));
                item.description = `${path.basename(element.speaker.path)} · L${element.speaker.lineNumber + 1}`;
                item.command = {
                    command: OPEN_LOCATION_COMMAND,
                    title: t('lexiconOpen'),
                    arguments: [element.speaker.uri.toString(), element.speaker.lineNumber],
                };
                item.contextValue = 'lexiconUsage';
                return item;
            }
            case 'implementation': {
                const item = this.leaf(
                    element.impl.signature,
                    'go-to-file',
                    `lexicon.impl.${element.parent.key}.${element.impl.path}:${element.impl.line}`
                );
                if (element.impl.speakerCount !== undefined) {
                    item.description = formatLexiconUsageCount(element.impl.speakerCount);
                }
                item.command = {
                    command: OPEN_LOCATION_COMMAND,
                    title: t('lexiconOpen'),
                    arguments: [element.impl.uri.toString(), element.impl.line],
                };
                item.contextValue = 'lexiconImplementation';
                return item;
            }
            case 'dialect': {
                const item = this.leaf(
                    element.dialect.phrase,
                    'link',
                    `lexicon.dialect.${element.parent.key}.${encodeURIComponent(element.dialect.key)}`
                );
                item.command = {
                    command: LEXICON_REVEAL_COMMAND,
                    title: t('lexiconOpen'),
                    arguments: [element.dialect.key],
                };
                item.contextValue = 'lexiconDialect';
                return item;
            }
            default:
                return this.leaf(t('lexiconIndexing'), 'sync', 'lexicon.unknown');
        }
    }

    getChildren(element?: LexiconNode): LexiconNode[] {
        if (!element) {
            return this.roots;
        }
        if (element.kind === 'word') {
            return this.children.get(element.key) ?? [];
        }
        return [];
    }

    getParent(element: LexiconNode): LexiconNode | undefined {
        if (element.kind === 'usage' || element.kind === 'implementation' || element.kind === 'dialect') {
            return element.parent;
        }
        return undefined;
    }

    private rebuild(): void {
        this.words.clear();
        this.children.clear();
        if (!this.snapshot.isReady()) {
            this.roots = [{ kind: 'indexing' }];
            return;
        }
        const lexicon = this.snapshot.getLexicon();
        if (!lexicon || lexicon.counts.words === 0) {
            this.roots = [{ kind: 'empty' }];
            return;
        }
        const roots: LexiconNode[] = [{ kind: 'summary', label: formatLexiconSummary(lexicon) }];
        for (const row of lexicon.rows) {
            const word: WordNode = {
                kind: 'word',
                key: row.key,
                label: row.phrase,
                description: formatLexiconWordDescription(row),
            };
            this.words.set(row.key, word);
            const kids: LexiconNode[] = [];
            for (const speaker of row.speakers ?? []) {
                kids.push({ kind: 'usage', speaker, parent: word });
            }
            for (const impl of row.implementations) {
                kids.push({ kind: 'implementation', impl, parent: word });
            }
            for (const dialect of row.dialects ?? []) {
                kids.push({ kind: 'dialect', dialect, parent: word });
            }
            this.children.set(row.key, kids);
            roots.push(word);
        }
        if (lexicon.truncated > 0) {
            roots.push({ kind: 'more', remaining: lexicon.truncated });
        }
        this.roots = roots;
    }

    private usageId(element: { speaker: LexiconSpeaker; parent: WordNode }): string {
        return `lexicon.usage.${element.parent.key}.${element.speaker.uri.toString()}:${element.speaker.lineNumber}`;
    }

    private leaf(label: string, iconId: string, id: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(iconId);
        item.id = id;
        return item;
    }
}

export function registerLexicon(
    context: vscode.ExtensionContext,
    snapshot: LexiconSnapshot
): { refresh: () => void; provider: LexiconTreeProvider } {
    const provider = new LexiconTreeProvider(snapshot);
    const treeView = vscode.window.createTreeView(LEXICON_VIEW_ID, {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    context.subscriptions.push(
        snapshot,
        provider,
        treeView,
        vscode.commands.registerCommand(LEXICON_FOCUS_COMMAND, async () => {
            if (!isLexiconEnabled()) {
                vscode.window.showInformationMessage(t('lexiconDisabled'));
                return;
            }
            await vscode.commands.executeCommand('workbench.view.explorer');
            provider.refresh();
            const roots = provider.getChildren();
            if (roots[0]) {
                await treeView.reveal(roots[0], { expand: true, focus: true, select: true });
            }
        }),
        vscode.commands.registerCommand(LEXICON_REVEAL_COMMAND, async (key: string) => {
            if (!isLexiconEnabled()) {
                vscode.window.showInformationMessage(t('lexiconDisabled'));
                return;
            }
            if (!key) {
                return;
            }
            await vscode.commands.executeCommand('workbench.view.explorer');
            const node = provider.findWord(key);
            if (!node) {
                return;
            }
            await treeView.reveal(node, { expand: true, focus: true, select: true });
        }),
        vscode.commands.registerCommand(OPEN_LOCATION_COMMAND, async (uriString: string, line: number) => {
            await navigateToLocation(vscode.Uri.parse(uriString), line);
        })
    );

    return {
        provider,
        refresh: () => snapshot.refresh(),
    };
}
