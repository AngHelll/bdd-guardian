/**
 * Resolve the FeatureStep under the cursor from a .feature document.
 */

import * as vscode from 'vscode';
import { parseFeatureDocument } from '../parsing/gherkinParser';
import type { FeatureStep, ResolvedKeyword, StepKeyword, ResolveResult } from '../domain/types';
import { normalizeWhitespace } from '../matching/normalization';
import type { createResolver } from '../matching/resolver';

const STEP_LINE_REGEX = /^\s*(Given|When|Then|And|But)\s+(.+)$/i;

/** Build a minimal TextDocument for headless / disk-read feature parsing. */
export function featureTextDocument(uri: vscode.Uri, text: string): vscode.TextDocument {
    const lines = text.split('\n');
    return {
        uri,
        getText: () => text,
        lineAt: (line: number) => {
            const lineText = lines[line] ?? '';
            return {
                text: lineText,
                lineNumber: line,
                range: new vscode.Range(line, 0, line, lineText.length),
                rangeIncludingLineBreak: new vscode.Range(line, 0, line, lineText.length),
                firstNonWhitespaceCharacterIndex: lineText.match(/^\s*/)?.[0].length ?? 0,
                isEmptyOrWhitespace: lineText.trim().length === 0,
            };
        },
    } as vscode.TextDocument;
}

/** Resolve step from raw feature file content (e.g. CodeLens when editor tab is closed). */
export function getStepAtPositionFromContent(
    uri: vscode.Uri,
    content: string,
    lineNumber: number
): FeatureStep | undefined {
    return getStepAtPosition(
        featureTextDocument(uri, content),
        new vscode.Position(lineNumber, 0)
    );
}

function resolveKeyword(keyword: string, previous: ResolvedKeyword): ResolvedKeyword {
    const lower = keyword.toLowerCase();
    if (lower === 'given') return 'Given';
    if (lower === 'when') return 'When';
    if (lower === 'then') return 'Then';
    return previous;
}

function normalizeStepKeyword(keyword: string): StepKeyword {
    const lower = keyword.toLowerCase();
    switch (lower) {
        case 'given': return 'Given';
        case 'when': return 'When';
        case 'then': return 'Then';
        case 'and': return 'And';
        case 'but': return 'But';
        default: return 'Given';
    }
}

/**
 * Prefer full parse (Scenario Outline candidates); fall back to single-line parse.
 */
export function getStepAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): FeatureStep | undefined {
    const feature = parseFeatureDocument(document);
    if (feature) {
        const fromIndex = feature.allSteps.find(s => s.lineNumber === position.line);
        if (fromIndex) {
            return fromIndex;
        }
    }

    const line = document.lineAt(position.line).text;
    const stepMatch = line.match(STEP_LINE_REGEX);
    if (!stepMatch) {
        return undefined;
    }

    const keywordOriginal = normalizeStepKeyword(stepMatch[1]);
    const rawText = stepMatch[2].trim();

    let keywordResolved: ResolvedKeyword = 'Given';
    if (keywordOriginal !== 'And' && keywordOriginal !== 'But') {
        keywordResolved = keywordOriginal as ResolvedKeyword;
    } else {
        for (let i = position.line - 1; i >= 0; i--) {
            const prev = document.lineAt(i).text.match(STEP_LINE_REGEX);
            if (prev) {
                keywordResolved = resolveKeyword(prev[1], 'Given');
                break;
            }
        }
    }

    return {
        keywordOriginal,
        keywordResolved,
        rawText,
        normalizedText: normalizeWhitespace(rawText),
        fullText: line.trim(),
        tagsEffective: [],
        uri: document.uri,
        range: new vscode.Range(position.line, 0, position.line, line.length),
        lineNumber: position.line,
        isOutline: false,
        candidateTexts: [normalizeWhitespace(rawText)],
    };
}

export function isFeatureDocument(doc: vscode.TextDocument): boolean {
    return (
        doc.languageId === 'feature' ||
        doc.languageId === 'gherkin' ||
        doc.languageId === 'cucumber' ||
        doc.fileName.endsWith('.feature')
    );
}

/**
 * Resolve a step at cursor using full Gherkin parse (outline + Scenario+Examples).
 */
export function resolveStepAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
    resolve: ReturnType<typeof createResolver>
): ResolveResult | undefined {
    const step = getStepAtPosition(document, position);
    if (!step) {
        return undefined;
    }
    return resolve(step);
}
