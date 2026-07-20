/**
 * Minimal TextDocument / Uri duck-types for headless parsing (no vscode import).
 */

export interface HeadlessUri {
    readonly fsPath: string;
    readonly scheme: string;
    readonly path: string;
    toString(): string;
}

export function fileUri(fsPath: string): HeadlessUri {
    return {
        fsPath,
        scheme: 'file',
        path: fsPath,
        toString: () => fsPath,
    };
}

export function makeTextDocument(fsPath: string, text: string): {
    uri: HeadlessUri;
    fileName: string;
    getText(): string;
    lineAt(line: number): {
        text: string;
        lineNumber: number;
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        rangeIncludingLineBreak: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
        firstNonWhitespaceCharacterIndex: number;
        isEmptyOrWhitespace: boolean;
    };
    lineCount: number;
} {
    const lines = text.split('\n');
    const uri = fileUri(fsPath);
    return {
        uri,
        fileName: fsPath,
        getText: () => text,
        lineCount: lines.length,
        lineAt: (line: number) => {
            const lineText = lines[line] ?? '';
            const range = {
                start: { line, character: 0 },
                end: { line, character: lineText.length },
            };
            return {
                text: lineText,
                lineNumber: line,
                range,
                rangeIncludingLineBreak: range,
                firstNonWhitespaceCharacterIndex: lineText.match(/^\s*/)?.[0].length ?? 0,
                isEmptyOrWhitespace: lineText.trim().length === 0,
            };
        },
    };
}
