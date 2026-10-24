/**
 * BDD Map hole row text. Pure so tests do not import VS Code.
 * Line numbers are 1-based, matching the editor gutter.
 */

/** Label is the step text or binding pattern, without a line prefix. */
export function formatSuiteMapHoleLabel(text: string): string {
    return text;
}

/**
 * Dimmed description. Ambiguous holes keep the candidate count beside the line.
 */
export function formatSuiteMapHoleDescription(lineNumber: number, matchCount?: number): string {
    const line = `L${lineNumber + 1}`;
    if (matchCount === undefined) {
        return line;
    }
    return `${line} · ${matchCount}`;
}
