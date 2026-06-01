/**
 * Go Godog step definition parser (MVP).
 *
 * Supported forms:
 * - ctx.Step(`^pattern$`, handler)
 * - ctx.Given / ctx.When / ctx.Then with backtick regex strings
 *
 * Godog patterns are Go regex strings (typically anchored with ^ $).
 */

import * as vscode from 'vscode';
import type { Binding, ResolvedKeyword } from '../domain/types';
import { compileBindingRegex } from './bindingRegex';

export interface GoGodogParseOptions {
    caseInsensitive?: boolean;
}

const GODOG_FILE_REGEX =
    /github\.com\/cucumber\/godog|godog\.ScenarioContext|godog\.Suite/;

const STEP_METHODS: ReadonlyArray<ResolvedKeyword> = ['Given', 'When', 'Then'];

/** ctx.Step(`^...$`, fn) or ctx.Given(`...`, fn) */
const STEP_CALL_REGEX =
    /\.(Step|Given|When|Then)\s*\(\s*`((?:\\.|[^`\\])*)`\s*,\s*(\w+)/g;

export function looksLikeGodogBindingFile(text: string): boolean {
    return GODOG_FILE_REGEX.test(text) || /\.(Step|Given|When|Then)\s*\(\s*`/.test(text);
}

export function parseGoGodogBindingsFromText(
    text: string,
    uri: vscode.Uri,
    options: GoGodogParseOptions = {}
): Binding[] {
    if (!looksLikeGodogBindingFile(text)) {
        return [];
    }

    const bindings: Binding[] = [];
    let match: RegExpExecArray | null;
    STEP_CALL_REGEX.lastIndex = 0;

    while ((match = STEP_CALL_REGEX.exec(text)) !== null) {
        const method = match[1];
        const patternRaw = match[2];
        const methodName = match[3];
        const before = text.slice(0, match.index);
        const lineNumber = before.split('\n').length - 1;
        const lineText = text.split('\n')[lineNumber] ?? '';

        const regex = compileBindingRegex(patternRaw, {
            caseInsensitive: options.caseInsensitive ?? false,
            expressionType: 'regex',
        });
        if (!regex) continue;

        const keywords =
            method === 'Step'
                ? (['Given', 'When', 'Then'] as const)
                : normalizeGodogKeyword(method)
                  ? ([normalizeGodogKeyword(method)!] as const)
                  : [];

        for (const keyword of keywords) {
            bindings.push({
                keyword,
                patternRaw,
                regex,
                className: 'Go',
                methodName,
                uri,
                range: new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
                lineNumber,
                signature: `${uri.fsPath}:${lineNumber}:${methodName}:${keyword}`,
            });
        }
    }

    return bindings;
}

function normalizeGodogKeyword(method: string): ResolvedKeyword | null {
    if (method === 'Step') {
        // Generic Step() — treat as Given for indexing (resolver matches all keywords via pattern)
        return 'Given';
    }
    if (STEP_METHODS.includes(method as ResolvedKeyword)) {
        return method as ResolvedKeyword;
    }
    return null;
}
