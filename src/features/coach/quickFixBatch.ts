export type CoachQuickFixInsert = { line: number; newText: string };

/**
 * Compute batch quick-fix inserts from diagnostics (pure helper for testing).
 *
 * MVP: supports `coach/outline-examples` by inserting an Examples template before the next
 * scenario/tag block.
 */
export function computeCoachQuickFixInserts(
    documentText: string,
    diagnostics: readonly { line: number; ruleId: string }[]
): CoachQuickFixInsert[] {
    const lines = documentText.split('\n');
    const inserts: CoachQuickFixInsert[] = [];

    const OUTLINE_RULE = 'coach/outline-examples';
    const EXAMPLES_LINE_REGEX = /^\s*Examples\s*:/i;
    const NEXT_BLOCK_REGEX = /^\s*(?:@|Feature:|Background:|Scenario Outline:|Scenario:)/i;

    const dedupeLines = new Set<number>();

    for (const d of diagnostics) {
        if (d.ruleId !== OUTLINE_RULE) continue;
        if (d.line < 0 || d.line >= lines.length) continue;

        // If an Examples block already exists below, don't insert.
        let insertLine = lines.length;
        for (let i = d.line + 1; i < lines.length; i++) {
            if (EXAMPLES_LINE_REGEX.test(lines[i])) {
                insertLine = -1;
                break;
            }
            if (NEXT_BLOCK_REGEX.test(lines[i])) {
                insertLine = i;
                break;
            }
        }
        if (insertLine <= 0) continue;
        if (dedupeLines.has(insertLine)) continue;
        dedupeLines.add(insertLine);

        inserts.push({
            line: insertLine,
            newText: '\n\n    Examples:\n      | placeholder |\n      | value       |\n',
        });
    }

    // Apply from bottom to top in VS Code to keep line numbers stable.
    return inserts.sort((a, b) => b.line - a.line);
}

