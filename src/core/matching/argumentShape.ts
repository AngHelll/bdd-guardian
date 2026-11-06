/**
 * Argument shape for a step binding.
 * Counts captures that actually matched, plus a DataTable or DocString.
 * Does not convert .NET types. An unreadable parameter list is left alone.
 */

import type { Binding, StepArgumentTail } from '../domain/types';

const TABLE_TYPES = new Set(['table', 'datatable']);

/** Capturing groups that participated in this match. Unmatched alternates are skipped. */
export function definedCaptureCount(regex: RegExp, text: string): number | undefined {
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (!match) {
        return undefined;
    }
    let count = 0;
    for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
            count++;
        }
    }
    return count;
}

function isTableType(typeName: string): boolean {
    const simple = typeName.replace(/\?$/, '').split('.').pop()?.toLowerCase() ?? '';
    return TABLE_TYPES.has(simple);
}

/**
 * True when this attribute can be called for the step.
 * `parameterTypes === undefined` means the signature was not read: do not reject it.
 */
export function argumentShapeCompatible(
    binding: Binding,
    matchedText: string,
    argumentTail: StepArgumentTail | undefined
): boolean {
    if (binding.parameterTypes === undefined) {
        return true;
    }

    const captures = definedCaptureCount(binding.regex, matchedText);
    if (captures === undefined) {
        return false;
    }

    const tail = argumentTail ?? 'none';
    let extra = 0;
    if (tail === 'table') {
        extra += 1;
    }
    if (tail === 'docstring') {
        extra += 1;
    }
    if (binding.parameterTypes.length !== captures + extra) {
        return false;
    }

    const hasTableParam = binding.parameterTypes.some(isTableType);
    if (tail === 'table') {
        return hasTableParam;
    }
    return !hasTableParam;
}
