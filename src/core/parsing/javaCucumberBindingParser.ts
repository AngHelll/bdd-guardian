/**
 * Java Cucumber-JVM step definition parser (MVP).
 *
 * Supported forms:
 * - import io.cucumber.java.en.* (or legacy cucumber.api.java.en.*)
 * - @Given("pattern") / @When("pattern") / @Then("pattern")
 * - @Given(value = "pattern") / @Given(value = { "pattern", ... }) — first string only
 */

import * as vscode from 'vscode';
import type { Binding, ResolvedKeyword } from '../domain/types';
import { compileBindingRegex } from './bindingRegex';

export interface JavaCucumberParseOptions {
    caseInsensitive?: boolean;
}

const CUCUMBER_JAVA_IMPORT_REGEX = /io\.cucumber\.java|cucumber\.api\.java/;

const ANNOTATION_REGEX =
    /@(Given|When|Then)\s*\(\s*(?:value\s*=\s*(?:\{\s*)?)?(['"])((?:\\.|(?!\2).)*)\2/g;

const STEP_KEYWORDS: ReadonlyArray<ResolvedKeyword> = ['Given', 'When', 'Then'];

function unescapeJavaStringLiteral(raw: string, quote: string): string {
    let inner = raw
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    if (quote === '"') inner = inner.replace(/\\"/g, '"');
    if (quote === "'") inner = inner.replace(/\\'/g, "'");
    return inner;
}

function findClassName(text: string): string {
    const match = text.match(/\bclass\s+(\w+)/);
    return match?.[1] ?? 'StepDefinitions';
}

function findMethodName(lines: string[], decoratorLine: number): string {
    for (let i = decoratorLine + 1; i < Math.min(decoratorLine + 8, lines.length); i++) {
        const trimmed = lines[i]?.trim() ?? '';
        if (!trimmed || trimmed.startsWith('@') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
            continue;
        }
        const methodMatch = trimmed.match(/(?:public|private|protected)\s+\S+\s+(\w+)\s*\(/);
        if (methodMatch) {
            return methodMatch[1];
        }
        if (trimmed.includes('{')) {
            break;
        }
    }
    return 'step';
}

function normalizeKeyword(raw: string): ResolvedKeyword {
    const lower = raw.toLowerCase();
    if (lower === 'given') return 'Given';
    if (lower === 'when') return 'When';
    return 'Then';
}

export function parseJavaCucumberBindingsFromText(
    text: string,
    uri: vscode.Uri,
    options: JavaCucumberParseOptions = {}
): Binding[] {
    if (!CUCUMBER_JAVA_IMPORT_REGEX.test(text)) {
        return [];
    }

    const lines = text.split('\n');
    const className = findClassName(text);
    const bindings: Binding[] = [];
    let match: RegExpExecArray | null;
    ANNOTATION_REGEX.lastIndex = 0;

    while ((match = ANNOTATION_REGEX.exec(text)) !== null) {
        const keyword = normalizeKeyword(match[1]);
        if (!STEP_KEYWORDS.includes(keyword)) continue;

        const quote = match[2];
        const patternRaw = unescapeJavaStringLiteral(match[3], quote);
        const before = text.slice(0, match.index);
        const lineNumber = before.split('\n').length - 1;
        const lineText = lines[lineNumber] ?? '';

        const regex = compileBindingRegex(patternRaw, { caseInsensitive: options.caseInsensitive ?? false });
        if (!regex) continue;

        const methodName = findMethodName(lines, lineNumber);

        bindings.push({
            keyword,
            patternRaw,
            regex,
            className,
            methodName,
            uri,
            range: new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
            lineNumber,
            signature: `${uri.fsPath}:${lineNumber}:${keyword}`,
        });
    }

    return bindings;
}
