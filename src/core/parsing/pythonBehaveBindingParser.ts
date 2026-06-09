/**
 * Python Behave step definition parser (MVP).
 *
 * Supported forms:
 * - from behave import given, when, then
 * - @given('pattern') / @when("pattern") / @then('pattern') on one line
 *
 * Behave {param} placeholders are compiled as non-whitespace captures (parse-style).
 */

import * as vscode from 'vscode';
import type { Binding, ResolvedKeyword } from '../domain/types';
import { compileBindingRegex } from './bindingRegex';

export interface PythonBehaveParseOptions {
    caseInsensitive?: boolean;
}

const BEHAVE_IMPORT_REGEX = /from\s+behave\s+import|import\s+behave\b/;

const DECORATOR_REGEX =
    /@(given|when|then)\s*\(\s*(['"])((?:\\.|(?!\2).)*)\2/gi;

const STEP_KEYWORDS: ReadonlyArray<ResolvedKeyword> = ['Given', 'When', 'Then'];

function unescapePythonStringLiteral(raw: string, quote: string): string {
    let inner = raw;
    inner = inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    if (quote === '"') inner = inner.replace(/\\"/g, '"');
    if (quote === "'") inner = inner.replace(/\\'/g, "'");
    return inner;
}

/**
 * Behave parse-style `{name}` → regex capture for a single token (MVP).
 */
function behavePatternToRegexSource(patternRaw: string): string {
    const parts: string[] = [];
    const placeholder = /\{([a-zA-Z_][\w]*)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    placeholder.lastIndex = 0;
    while ((match = placeholder.exec(patternRaw)) !== null) {
        const before = patternRaw.slice(lastIndex, match.index);
        parts.push(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        parts.push('(\\S+)');
        lastIndex = match.index + match[0].length;
    }
    const after = patternRaw.slice(lastIndex);
    parts.push(after.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return parts.join('');
}

function compileBehavePattern(
    patternRaw: string,
    caseInsensitive: boolean
): RegExp | null {
    if (/\{[a-zA-Z_][\w]*\}/.test(patternRaw)) {
        const source = behavePatternToRegexSource(patternRaw);
        return compileBindingRegex(source, { caseInsensitive, expressionType: 'regex' });
    }
    return compileBindingRegex(patternRaw, { caseInsensitive });
}

function findFunctionName(lines: string[], decoratorLine: number): string {
    for (let i = decoratorLine + 1; i < Math.min(decoratorLine + 6, lines.length); i++) {
        const trimmed = lines[i]?.trim() ?? '';
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) {
            continue;
        }
        const defMatch = trimmed.match(/^def\s+([a-zA-Z_][\w]*)\s*\(/);
        if (defMatch) {
            return defMatch[1];
        }
        break;
    }
    return 'step_impl';
}

function normalizeKeyword(raw: string): ResolvedKeyword {
    const lower = raw.toLowerCase();
    if (lower === 'given') return 'Given';
    if (lower === 'when') return 'When';
    return 'Then';
}

export function parsePythonBehaveBindingsFromText(
    text: string,
    uri: vscode.Uri,
    options: PythonBehaveParseOptions = {}
): Binding[] {
    if (!BEHAVE_IMPORT_REGEX.test(text)) {
        return [];
    }

    const lines = text.split('\n');
    const bindings: Binding[] = [];
    let match: RegExpExecArray | null;
    DECORATOR_REGEX.lastIndex = 0;

    while ((match = DECORATOR_REGEX.exec(text)) !== null) {
        const keyword = normalizeKeyword(match[1]);
        if (!STEP_KEYWORDS.includes(keyword)) continue;

        const quote = match[2];
        const patternRaw = unescapePythonStringLiteral(match[3], quote);
        const before = text.slice(0, match.index);
        const lineNumber = before.split('\n').length - 1;
        const lineText = lines[lineNumber] ?? '';

        const regex = compileBehavePattern(patternRaw, options.caseInsensitive ?? false);
        if (!regex) continue;

        const methodName = findFunctionName(lines, lineNumber);
        const moduleName = uri.fsPath.split(/[/\\]/).pop()?.replace(/\.py$/, '') ?? 'steps';

        bindings.push({
            keyword,
            patternRaw,
            regex,
            className: moduleName,
            methodName,
            uri,
            range: new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
            lineNumber,
            signature: `${uri.fsPath}:${lineNumber}:${keyword}`,
        });
    }

    return bindings;
}
