/**
 * Shared C# step-binding parser for Reqnroll and SpecFlow.
 * Same [Given]/[When]/[Then] attribute model — providers differ only in detection.
 */

import * as vscode from 'vscode';
import { Binding, ResolvedKeyword } from '../domain/types';
import {
    BINDING_ATTRIBUTE_REGEX,
    CLASS_DECLARATION_REGEX,
    METHOD_DECLARATION_REGEX,
} from '../domain/constants';
import { compileBindingRegex, type BindingExpressionType } from './bindingRegex';

export interface CSharpBindingParseOptions {
    caseInsensitive?: boolean;
}

/** Matches Scope(Tag = "…") / Scope(Tag = @"…") inside or as attributes. */
const SCOPE_TAG_IN_ATTR_REGEX = /Scope\s*\(\s*Tag\s*=\s*@?"([^"]*)"\s*\)/gi;

/**
 * Parse all step bindings from C# source text (Reqnroll, SpecFlow, etc.).
 */
export function parseCSharpBindingsFromText(
    text: string,
    uri: vscode.Uri,
    options: CSharpBindingParseOptions = {}
): Binding[] {
    const bindings: Binding[] = [];
    const lines = text.split('\n');
    const classNames = findClassNames(text);
    const classScopeTags = buildClassScopeTagMap(text, classNames);

    let match: RegExpExecArray | null;
    const attributeRegex = new RegExp(BINDING_ATTRIBUTE_REGEX.source, 'g');

    while ((match = attributeRegex.exec(text)) !== null) {
        const attrName = match[1];
        const patternWithQuotes = match[2];
        const patternRaw = extractCSharpPatternString(patternWithQuotes);
        const fullAttributeText = match[0];

        const beforeMatch = text.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length - 1;
        const className = findEnclosingClassName(text, match.index, classNames);

        const afterAttribute = text.substring(match.index + match[0].length);
        const methodRegex = new RegExp(METHOD_DECLARATION_REGEX.source, 'g');
        const methodMatch = methodRegex.exec(afterAttribute);
        const methodName = methodMatch ? methodMatch[1] : 'Unknown';

        const expressionType = inferExpressionTypeOverride(fullAttributeText);
        const methodScopeTags = extractScopeTagsFromText(
            findMethodAttributeBlock(text, match.index, methodMatch ? match.index + match[0].length + methodMatch.index : match.index + match[0].length)
        );
        const scopeTags = uniqueTags([
            ...(classScopeTags.get(className) ?? []),
            ...methodScopeTags,
        ]);

        const keywords: ResolvedKeyword[] =
            attrName === 'StepDefinition' ? ['Given', 'When', 'Then'] : [attrName as ResolvedKeyword];

        for (const keyword of keywords) {
            const compiledRegex = compileBindingRegex(patternRaw, {
                caseInsensitive: options.caseInsensitive ?? false,
                expressionType,
            });
            if (!compiledRegex) {
                continue;
            }

            bindings.push({
                keyword,
                patternRaw,
                regex: compiledRegex,
                className,
                methodName,
                uri,
                range: new vscode.Range(lineNumber, 0, lineNumber, lines[lineNumber]?.length ?? 0),
                lineNumber,
                signature: `${className}.${methodName}`,
                scopeTags,
            });
        }
    }

    return bindings;
}

/**
 * Extract pattern string from a C# string literal in a step attribute.
 */
export function extractCSharpPatternString(raw: string): string {
    let pattern = raw.trim();
    const isVerbatim = pattern.startsWith('@');

    if (isVerbatim) {
        pattern = pattern.substring(1);
    }

    if (pattern.startsWith('"') && pattern.endsWith('"')) {
        pattern = pattern.substring(1, pattern.length - 1);
    }

    if (isVerbatim) {
        return pattern.replace(/""/g, '"');
    }

    return pattern
        .replace(/\\\\/g, '\x00BACKSLASH\x00')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\x00BACKSLASH\x00/g, '\\');
}

/** Exported for unit tests. */
export function extractScopeTagsFromText(text: string): string[] {
    const tags: string[] = [];
    const re = new RegExp(SCOPE_TAG_IN_ATTR_REGEX.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const raw = m[1].trim().replace(/^@+/, '');
        if (raw.length > 0) {
            tags.push(raw);
        }
    }
    return uniqueTags(tags);
}

function uniqueTags(tags: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tags) {
        const key = t.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            out.push(t);
        }
    }
    return out;
}

function findClassNames(text: string): Array<{ name: string; index: number }> {
    const classes: Array<{ name: string; index: number }> = [];
    const regex = new RegExp(CLASS_DECLARATION_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        classes.push({ name: match[1], index: match.index });
    }
    return classes;
}

function buildClassScopeTagMap(
    text: string,
    classes: Array<{ name: string; index: number }>
): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (let i = 0; i < classes.length; i++) {
        const cls = classes[i];
        const prevEnd = i > 0 ? classes[i - 1].index : 0;
        const regionStart = Math.max(prevEnd, cls.index - 800);
        map.set(cls.name, extractScopeTagsFromText(text.slice(regionStart, cls.index)));
    }
    return map;
}

/**
 * Attribute cluster from preceding `[…]` attrs through the step attribute (and siblings)
 * up to — but not past — the method name region end.
 */
function findMethodAttributeBlock(text: string, attributeIndex: number, blockEnd: number): string {
    let start = attributeIndex;
    while (start > 0) {
        let i = start - 1;
        while (i >= 0 && /\s/.test(text[i])) {
            i--;
        }
        if (i < 0 || text[i] !== ']') {
            break;
        }
        let depth = 1;
        let j = i - 1;
        while (j >= 0 && depth > 0) {
            if (text[j] === ']') {
                depth++;
            } else if (text[j] === '[') {
                depth--;
            }
            j--;
        }
        if (depth !== 0) {
            break;
        }
        start = j + 1;
    }
    return text.slice(start, Math.max(blockEnd, attributeIndex));
}

function findEnclosingClassName(
    text: string,
    attributeIndex: number,
    classes: Array<{ name: string; index: number }>
): string {
    let className = 'Unknown';
    for (const cls of classes) {
        if (cls.index < attributeIndex) {
            className = cls.name;
        } else {
            break;
        }
    }
    return className;
}

function inferExpressionTypeOverride(attributeText: string): BindingExpressionType {
    // Reqnroll supports ExpressionType = ExpressionType.CucumberExpression / RegularExpression.
    if (/ExpressionType\s*=\s*ExpressionType\.CucumberExpression/.test(attributeText)) {
        return 'cucumber';
    }
    if (/ExpressionType\s*=\s*ExpressionType\.RegularExpression/.test(attributeText)) {
        return 'regex';
    }
    return 'auto';
}
