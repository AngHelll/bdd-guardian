/**
 * Binding identity for reference matching (file + attribute line).
 */

import type { Binding } from '../domain/types';

export function sameBinding(a: Binding, b: Binding): boolean {
    return a.uri.toString() === b.uri.toString() && a.lineNumber === b.lineNumber;
}

export function getBindingsForUri(
    allBindings: readonly Binding[],
    uri: { toString(): string }
): Binding[] {
    const key = uri.toString();
    return allBindings
        .filter(b => b.uri.toString() === key)
        .sort((a, b) => a.lineNumber - b.lineNumber);
}

/**
 * Binding at cursor: exact attribute line, else range containing the line.
 */
export function findBindingAtLine(bindings: readonly Binding[], line: number): Binding | undefined {
    const exact = bindings.find(b => b.lineNumber === line);
    if (exact) {
        return exact;
    }
    return bindings.find(
        b => line >= b.range.start.line && line <= b.range.end.line
    );
}
