/**
 * pytest-bdd step definition parser (MVP).
 *
 * Supported forms:
 * - from pytest_bdd import given, when, then
 * - @given('pattern') / @when("pattern") / @then('pattern') on one line
 *
 * `{name}` and `{name:converter}` compile as a single non-whitespace capture.
 * The converter (`:d`, `:s`, …) is not interpreted.
 */

import * as vscode from 'vscode';
import type { Binding, ResolvedKeyword } from '../domain/types';
import { compileBindingRegex } from './bindingRegex';

export interface PythonPytestBddParseOptions {
    caseInsensitive?: boolean;
}

const PYTEST_BDD_IMPORT_REGEX = /from\s+pytest_bdd\s+import|import\s+pytest_bdd\b/;

const DECORATOR_REGEX =
    /@(given|when|then)[ \t]*\([ \t]*(['"])((?:\\.|(?!\2).)*)\2/gi;

const PLACEHOLDER = /\{([a-zA-Z_][\w]*)(?::[^}]+)?\}/g;

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

function pytestBddPatternToRegexSource(patternRaw: string): string {
    const parts: string[] = [];
    const placeholder = new RegExp(PLACEHOLDER.source, 'g');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = placeholder.exec(patternRaw)) !== null) {
        const before = patternRaw.slice(lastIndex, match.index);
        parts.push(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        parts.push('(\\S+)');
        lastIndex = match.index + match[0].length;
    }
    parts.push(patternRaw.slice(lastIndex).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return parts.join('');
}

function compilePytestBddPattern(patternRaw: string, caseInsensitive: boolean): RegExp | null {
    if (new RegExp(PLACEHOLDER.source).test(patternRaw)) {
        const source = pytestBddPatternToRegexSource(patternRaw);
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

export function parsePythonPytestBddBindingsFromText(
    text: string,
    uri: vscode.Uri,
    options: PythonPytestBddParseOptions = {}
): Binding[] {
    if (!PYTEST_BDD_IMPORT_REGEX.test(text)) {
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

        const regex = compilePytestBddPattern(patternRaw, options.caseInsensitive ?? false);
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
            scopeTags: [],
        });
    }

    return bindings;
}
