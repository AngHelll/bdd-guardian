/**
 * VS Code completion provider: suggest steps from indexed bindings.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import {
    filterBindingsForCompletion,
    findPreviousStrongKeyword,
    parseStepCompletionLine,
    type BindingCompletionSource,
} from '../../core/autocomplete';
import type { ResolvedKeyword } from '../../core/domain';

export class StepCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private readonly indexManager: IndexManager) {}

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        if (!isAutocompleteEnabled()) {
            return [];
        }

        const line = document.lineAt(position.line).text;
        const linesAbove: string[] = [];
        for (let i = 0; i < position.line; i++) {
            linesAbove.push(document.lineAt(i).text);
        }
        const previousStrong = findPreviousStrongKeyword(linesAbove);
        const ctx = parseStepCompletionLine(line, previousStrong);
        if (!ctx.eligible) {
            return [];
        }

        const index = this.indexManager.getIndex();
        const all = index.getAllBindings();
        if (all.length === 0) {
            return [];
        }

        const sources: BindingCompletionSource[] = all.map((b) => ({
            keyword: b.keyword as ResolvedKeyword,
            patternRaw: b.patternRaw,
            methodName: b.methodName,
            filePath: vscode.workspace.asRelativePath(b.uri),
        }));

        // Only replace typed body when keyword is present; MVP never inserts keyword
        // because eligible lines always have a keyword token.
        const includeKeywordInInsert = !ctx.keywordPresent;
        const candidates = filterBindingsForCompletion(sources, {
            keyword: ctx.keywordResolved,
            prefix: linePrefixUpToCursor(line, position, ctx.bodyStartColumn),
            includeKeywordInInsert,
        });

        const replaceRange = new vscode.Range(
            position.line,
            ctx.bodyStartColumn,
            position.line,
            line.length
        );

        return candidates.map((c) => {
            const item = new vscode.CompletionItem(c.label, vscode.CompletionItemKind.Text);
            item.insertText = c.insertText;
            item.detail = c.detail;
            item.documentation = new vscode.MarkdownString(
                '```\n' + c.documentation + '\n```'
            );
            item.sortText = c.sortText;
            item.range = replaceRange;
            item.filterText = `${c.label} ${c.patternRaw} ${c.methodName}`;
            return item;
        });
    }
}

export function isAutocompleteEnabled(): boolean {
    return vscode.workspace.getConfiguration('bddGuardian.autocomplete').get<boolean>('enabled', true);
}

function linePrefixUpToCursor(
    line: string,
    position: vscode.Position,
    bodyStartColumn: number
): string {
    if (position.character <= bodyStartColumn) {
        return '';
    }
    return line.slice(bodyStartColumn, position.character).trimStart();
}
