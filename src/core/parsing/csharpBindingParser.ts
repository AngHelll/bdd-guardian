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
    /** Workspace map. When omitted, types are collected from this file only. */
    parameterTypes?: Readonly<Record<string, string>>;
}

/** One file's `[StepArgumentTransformation]` scan. Duplicates are not usable names. */
export interface CSharpParameterTypeScan {
    readonly types: ReadonlyMap<string, string>;
    readonly duplicates: ReadonlySet<string>;
}

const BUILT_IN_PARAMETER_TYPES = new Set([
    'int',
    'long',
    'short',
    'byte',
    'biginteger',
    'float',
    'double',
    'bigdecimal',
    'decimal',
    'guid',
    'word',
    'string',
]);

const PLACEHOLDER_NAME = /^[A-Za-z][\w-]*$/;
const SIMPLE_RETURN_TYPE = /^[A-Za-z_][\w]*$/;

/** Matches Scope(Tag = "…") / Scope(Tag = @"…") inside or as attributes. */
const SCOPE_TAG_IN_ATTR_REGEX = /Scope\s*\(\s*Tag\s*=\s*@?"([^"]*)"\s*\)/gi;

/**
 * `[Binding]` inventory. Same prefixes as step attributes.
 * This does not decide whether a method is emitted.
 */
const CSHARP_BINDING_MARKER_REGEX =
    /\[\s*(?:(?:global::\s*)?(?:(Reqnroll)|(TechTalk\s*\.\s*SpecFlow))\s*\.\s*)?Binding(Attribute)?\s*(?:\(\s*\))?\s*\]/g;

export type CSharpAttributeNamespace = 'unqualified' | 'reqnroll' | 'specflow';

export interface CSharpBindingAttributeMatch {
    readonly text: string;
    readonly index: number;
    readonly namespace: CSharpAttributeNamespace;
    readonly attributeSuffix: boolean;
}

/** Lists `[Binding]` attributes. Callers must not drop step methods from this list. */
export function findCSharpBindingAttributes(text: string): CSharpBindingAttributeMatch[] {
    const found: CSharpBindingAttributeMatch[] = [];
    const regex = new RegExp(CSHARP_BINDING_MARKER_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const namespace: CSharpAttributeNamespace = match[1]
            ? 'reqnroll'
            : match[2]
                ? 'specflow'
                : 'unqualified';
        found.push({
            text: match[0],
            index: match.index,
            namespace,
            attributeSuffix: match[3] !== undefined,
        });
    }
    return found;
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
    const classScopeTags = buildClassScopeTagMap(text, classNames);
    const parameterTypes = options.parameterTypes ?? mergeCSharpParameterTypes([
        collectCSharpParameterTypes(text),
    ]);

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
                parameterTypes,
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

/**
 * `[StepArgumentTransformation(@"regex")]` / `Name = "…"` on a single line.
 * Without Name, the name is a simple return type on the following method.
 * A name seen twice in this file is listed in `duplicates` and omitted from `types`.
 */
export function collectCSharpParameterTypes(text: string): CSharpParameterTypeScan {
    const counts = new Map<string, { regex: string; count: number }>();
    const start = /\[StepArgumentTransformation\b/g;
    let match: RegExpExecArray | null;
    while ((match = start.exec(text)) !== null) {
        const lineEnd = text.indexOf('\n', match.index);
        const line = text.slice(match.index, lineEnd === -1 ? text.length : lineEnd);
        if (!line.includes(']')) {
            continue;
        }
        const parsed = parseTransformationAttribute(line);
        if (!parsed) {
            continue;
        }
        const name = parsed.name !== undefined
            ? parsed.name
            : findFollowingReturnType(text.slice(lineEnd === -1 ? text.length : lineEnd));
        if (!name || !PLACEHOLDER_NAME.test(name) || BUILT_IN_PARAMETER_TYPES.has(name.toLowerCase())) {
            continue;
        }
        if (!isCompilableRegex(parsed.regex)) {
            continue;
        }
        const previous = counts.get(name);
        if (!previous) {
            counts.set(name, { regex: parsed.regex, count: 1 });
        } else {
            previous.count += 1;
        }
    }

    const types = new Map<string, string>();
    const duplicates = new Set<string>();
    for (const [name, info] of counts) {
        if (info.count === 1) {
            types.set(name, info.regex);
        } else {
            duplicates.add(name);
        }
    }
    return { types, duplicates };
}

/** Drop a name that appears more than once in one file or across files. */
export function mergeCSharpParameterTypes(
    scans: readonly CSharpParameterTypeScan[]
): Record<string, string> {
    const counts = new Map<string, { regex: string; count: number }>();
    const banned = new Set<string>();
    for (const scan of scans) {
        for (const name of scan.duplicates) {
            banned.add(name);
        }
        for (const [name, regex] of scan.types) {
            const previous = counts.get(name);
            if (!previous) {
                counts.set(name, { regex, count: 1 });
            } else {
                previous.count += 1;
            }
        }
    }
    const merged: Record<string, string> = {};
    for (const [name, info] of counts) {
        if (info.count === 1 && !banned.has(name)) {
            merged[name] = info.regex;
        }
    }
    return merged;
}

function parseTransformationAttribute(line: string): { regex: string; name?: string } | null {
    const open = line.indexOf('(');
    if (open < 0) {
        return null;
    }
    const stringMatch = line.slice(open + 1).match(/^\s*(@?"(?:[^"\\]|\\.|"")*")/);
    if (!stringMatch) {
        return null;
    }
    const nameMatch = line.match(/\bName\s*=\s*"([^"]*)"/);
    return {
        regex: extractCSharpPatternString(stringMatch[1]),
        name: nameMatch ? nameMatch[1] : undefined,
    };
}

function findFollowingReturnType(afterAttribute: string): string | undefined {
    const match = afterAttribute.match(
        /(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?([^\s(]+)\s+[A-Za-z_][\w]*\s*\(/
    );
    if (!match) {
        return undefined;
    }
    const returnType = match[1];
    if (returnType === 'void' || returnType === 'Task' || !SIMPLE_RETURN_TYPE.test(returnType)) {
        return undefined;
    }
    return returnType;
}

function isCompilableRegex(source: string): boolean {
    try {
        new RegExp(source);
        return true;
    } catch {
        return false;
    }
}
