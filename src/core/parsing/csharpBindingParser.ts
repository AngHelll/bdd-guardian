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

function findClassNames(text: string): Array<{ name: string; index: number }> {
    const classes: Array<{ name: string; index: number }> = [];
    const regex = new RegExp(CLASS_DECLARATION_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        classes.push({ name: match[1], index: match.index });
    }
    return classes;
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
