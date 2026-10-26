/**
 * BDD Map hole row text. Pure so tests do not import VS Code.
 * Line numbers are 1-based, matching the editor gutter.
 */

import { presentOrphanScan, type SuiteMapSummary } from '../../core/map/suiteMap';

export interface SuiteMapMessage {
    readonly key: string;
    readonly args: readonly string[];
}

/** Summary line. A skipped or unavailable scan does not interpolate the legacy zero. */
export function suiteMapSummaryMessage(
    summary: Pick<SuiteMapSummary, 'orphanScan' | 'counts'>
): SuiteMapMessage {
    const counts = summary.counts;
    const head = [String(counts.bound), String(counts.unbound), String(counts.ambiguous)];
    const presented = presentOrphanScan(summary);
    if (presented.status === 'complete') {
        return {
            key: 'suiteMapSummary',
            args: [...head, String(presented.orphanBindings)],
        };
    }
    return {
        key: presented.status === 'skipped'
            ? 'suiteMapSummaryOrphansSkipped'
            : 'suiteMapSummaryOrphansUnavailable',
        args: head,
    };
}

/** Orphan group title. Same rule as the summary: no count unless the scan completed. */
export function suiteMapOrphanGroupMessage(
    summary: Pick<SuiteMapSummary, 'orphanScan' | 'counts'>
): SuiteMapMessage {
    const presented = presentOrphanScan(summary);
    if (presented.status === 'complete') {
        return { key: 'suiteMapOrphans', args: [String(presented.orphanBindings)] };
    }
    if (presented.status === 'skipped') {
        return { key: 'suiteMapOrphansSkipped', args: [] };
    }
    return { key: 'suiteMapOrphansUnavailable', args: [] };
}

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
