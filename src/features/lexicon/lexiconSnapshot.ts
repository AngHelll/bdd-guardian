/**
 * Cached lexicon for the tree and the usage CodeLens.
 * Rebuilds on index changes only while the view is enabled.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { FILE_WATCHER_DEBOUNCE_MS, ResolvedKeyword } from '../../core/domain';
import { buildLexicon, type Lexicon } from '../../core/lexicon/lexicon';
import { createResolver, applyMatchingSettings, type ResolverDependencies } from '../../core/matching';
import { collectAllIndexedSteps } from '../../core/references';

export function isLexiconEnabled(): boolean {
    return vscode.workspace.getConfiguration('bddGuardian.lexicon').get<boolean>('enabled', false);
}

export interface LexiconUsage {
    readonly key: string;
    readonly count: number;
}

export class LexiconSnapshot implements vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly indexSub: vscode.Disposable;
    private lexicon: Lexicon | undefined;
    private readonly speakers = new Map<string, LexiconUsage>();
    private ready = false;

    constructor(private readonly indexManager: IndexManager) {
        this.indexSub = indexManager.getIndex().onDidChange(() => this.schedule());
    }

    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.indexSub.dispose();
        this._onDidChange.dispose();
    }

    /** Rebuild now. When the setting is off, drop the cache instead of resolving. */
    refresh(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
        if (!isLexiconEnabled()) {
            this.clear();
            this._onDidChange.fire();
            return;
        }
        this.rebuild();
    }

    schedule(): void {
        if (!isLexiconEnabled()) {
            this.clear();
            this._onDidChange.fire();
            return;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = undefined;
            this.rebuild();
        }, FILE_WATCHER_DEBOUNCE_MS);
    }

    isReady(): boolean {
        return this.ready;
    }

    getLexicon(): Lexicon | undefined {
        return this.ready ? this.lexicon : undefined;
    }

    usageAt(uri: vscode.Uri, line: number): LexiconUsage | undefined {
        if (!isLexiconEnabled() || !this.lexicon || this.lexicon.usagesSkipped) {
            return undefined;
        }
        return this.speakers.get(`${uri.toString()}:${line}`);
    }

    private clear(): void {
        this.ready = false;
        this.lexicon = undefined;
        this.speakers.clear();
    }

    private rebuild(): void {
        const index = this.indexManager.getIndex();
        if (index.getData().lastIndexed.getTime() === 0) {
            this.clear();
            this._onDidChange.fire();
            return;
        }
        const allBindings = index.getAllBindings();
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw: ResolvedKeyword) => index.getBindingsByKeyword(kw),
        };
        const resolve = createResolver(applyMatchingSettings(deps));
        const lexicon = buildLexicon(allBindings, collectAllIndexedSteps(index), resolve);
        this.lexicon = lexicon;
        this.speakers.clear();
        for (const usage of lexicon.usageLocations ?? []) {
            this.speakers.set(`${usage.uri.toString()}:${usage.lineNumber}`, {
                key: usage.key,
                count: usage.count,
            });
        }
        this.ready = true;
        this._onDidChange.fire();
    }
}
