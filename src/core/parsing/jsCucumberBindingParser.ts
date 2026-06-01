/**
 * JavaScript/TypeScript Cucumber.js step definition parser (MVP).
 *
 * Supported forms:
 * - import { Given, When, Then } from '@cucumber/cucumber'
 * - const { Given, When, Then } = require('@cucumber/cucumber')
 * - Given('pattern', fn) / When("pattern", fn) / Then(`pattern`, fn)
 * - Given(/regex/, fn)
 *
 * Notes:
 * - This is a best-effort static parser (regex-based). It intentionally avoids
 *   running a JS parser/AST to keep dependencies minimal in MVP.
 * - We only parse files that appear to reference @cucumber/cucumber.
 */

import * as vscode from 'vscode';
import type { Binding, ResolvedKeyword } from '../domain/types';
import { compileBindingRegex } from './bindingRegex';

export interface JsCucumberParseOptions {
    caseInsensitive?: boolean;
}

const CUCUMBER_IMPORT_REGEX =
    /from\s+['"]@cucumber\/cucumber['"]|require\s*\(\s*['"]@cucumber\/cucumber['"]\s*\)/;

const STEP_FN_NAMES: ReadonlyArray<ResolvedKeyword> = ['Given', 'When', 'Then'];

// Matches Given( <arg> ,  ... ) where <arg> is string literal / template / regex literal.
const STEP_CALL_REGEX =
    /\b(Given|When|Then)\s*\(\s*(\/(?:\\.|[^/\\])+(?:\/[gimsuy]*)|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*,/g;

function unescapeJsStringLiteral(raw: string): string {
    // raw includes the quotes.
    const quote = raw[0];
    let inner = raw.slice(1, -1);
    // Minimal escape support (enough for typical step patterns).
    inner = inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    if (quote === '"') inner = inner.replace(/\\"/g, '"');
    if (quote === "'") inner = inner.replace(/\\'/g, "'");
    if (quote === '`') inner = inner.replace(/\\`/g, '`');
    return inner;
}

function parseRegexLiteral(raw: string): { source: string; flags: string } | null {
    // raw is like /.../flags, where ... may contain escaped slashes.
    const m = raw.match(/^\/((?:\\.|[^/\\])+?)\/([gimsuy]*)$/);
    if (!m) return null;
    return { source: m[1], flags: m[2] ?? '' };
}

function anchorIfNeeded(source: string): string {
    let out = source;
    if (!out.startsWith('^')) out = '^' + out;
    if (!out.endsWith('$')) out = out + '$';
    return out;
}

function compileRegexLiteral(source: string, flags: string): RegExp | null {
    try {
        const anchored = anchorIfNeeded(source);
        const withU = flags.includes('u') ? flags : flags + 'u';
        return new RegExp(anchored, withU);
    } catch {
        return null;
    }
}

export function parseJsCucumberBindingsFromText(
    text: string,
    uri: vscode.Uri,
    options: JsCucumberParseOptions = {}
): Binding[] {
    // Fast reject: only parse files that reference @cucumber/cucumber.
    if (!CUCUMBER_IMPORT_REGEX.test(text)) {
        return [];
    }

    const bindings: Binding[] = [];
    let match: RegExpExecArray | null;
    STEP_CALL_REGEX.lastIndex = 0;

    while ((match = STEP_CALL_REGEX.exec(text)) !== null) {
        const keyword = match[1] as ResolvedKeyword;
        if (!STEP_FN_NAMES.includes(keyword)) continue;

        const argRaw = match[2];
        const before = text.slice(0, match.index);
        const lineNumber = before.split('\n').length - 1;
        const lineText = text.split('\n')[lineNumber] ?? '';

        let regex: RegExp | null = null;
        let patternRaw = '';

        if (argRaw.startsWith('/')) {
            const parsed = parseRegexLiteral(argRaw);
            if (!parsed) continue;
            patternRaw = parsed.source;
            regex = compileRegexLiteral(parsed.source, parsed.flags);
        } else {
            patternRaw = unescapeJsStringLiteral(argRaw);
            regex = compileBindingRegex(patternRaw, { caseInsensitive: options.caseInsensitive ?? false });
        }

        if (!regex) continue;

        bindings.push({
            keyword,
            patternRaw,
            regex,
            className: 'JS',
            methodName: `${keyword}(...)`,
            uri,
            range: new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
            lineNumber,
            signature: `${uri.fsPath}:${lineNumber}:${keyword}`,
        });
    }

    return bindings;
}

