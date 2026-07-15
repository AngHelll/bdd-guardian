/**
 * Redundant Tags Rule
 * Scenario tags that already appear on Feature are noise (Feature tags inherit).
 */

import { CoachRule, CoachFinding, GherkinModel, CoachSeverity } from './types';

export function normalizeCoachTag(tag: string): string {
    const t = tag.trim().toLowerCase();
    if (!t) {
        return '';
    }
    return t.startsWith('@') ? t : `@${t}`;
}

/**
 * Remove a tag token from a Gherkin tag line. Returns null if the line should be deleted.
 */
export function removeTagFromLine(lineText: string, tag: string): string | null {
    const target = normalizeCoachTag(tag);
    if (!target) {
        return lineText;
    }
    const trimmed = lineText.trim();
    if (!trimmed.startsWith('@') && !/@/.test(trimmed)) {
        return lineText;
    }

    const parts = lineText.split(/(\s+)/);
    const kept: string[] = [];
    let removed = false;
    for (const part of parts) {
        if (/^\s+$/.test(part) || part === '') {
            kept.push(part);
            continue;
        }
        if (normalizeCoachTag(part) === target) {
            removed = true;
            continue;
        }
        kept.push(part);
    }
    if (!removed) {
        return lineText;
    }

    const rebuilt = kept.join('').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/g, '');
    const onlyWs = rebuilt.trim().length === 0;
    if (onlyWs) {
        return null;
    }
    // Preserve leading indent from original
    const indent = lineText.match(/^\s*/)?.[0] ?? '';
    const body = rebuilt.trimStart();
    return indent + body;
}

/**
 * Walk upward from startLine to find a line containing the tag.
 */
export function findTagLineAbove(
    lines: readonly string[],
    startLine: number,
    tag: string
): number | null {
    const target = normalizeCoachTag(tag);
    if (!target || lines.length === 0) {
        return null;
    }
    const start = Math.min(Math.max(0, startLine), lines.length - 1);
    for (let i = start; i >= 0; i--) {
        const line = lines[i];
        if (/^\s*(Feature|Background)\s*:/i.test(line)) {
            break;
        }
        const tokens = line.trim().split(/\s+/).filter((t) => t.startsWith('@'));
        if (tokens.some((t) => normalizeCoachTag(t) === target)) {
            return i;
        }
        if (i < start && /^\s*Scenario(?:\s+Outline)?\s*:/i.test(line)) {
            break;
        }
    }
    return null;
}

export class RedundantTagsRule implements CoachRule {
    readonly id = 'coach/redundant-tags';
    readonly name = 'Redundant Tags';
    readonly description =
        'Scenario tags that already appear on the Feature are redundant (Feature tags apply to all scenarios).';
    readonly severity: CoachSeverity = 'info';

    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];
        const featureSet = new Set(model.featureTags.map(normalizeCoachTag).filter(Boolean));
        if (featureSet.size === 0) {
            return findings;
        }

        for (const scenario of model.scenarios) {
            for (const tag of scenario.tags) {
                const normalized = normalizeCoachTag(tag);
                if (!normalized || !featureSet.has(normalized)) {
                    continue;
                }
                findings.push({
                    ruleId: this.id,
                    message: `Redundant tag "${normalized}": already declared on Feature.`,
                    severity: 'info',
                    line: Math.max(0, scenario.line - 1),
                    column: 0,
                    fixes: [
                        {
                            title: `Remove redundant ${normalized}`,
                            newText: normalized,
                        },
                    ],
                });
            }
        }

        return findings;
    }
}

export const redundantTagsRule = new RedundantTagsRule();

/** Extract @tag from redundant-tags finding message. */
export function parseRedundantTagFromMessage(message: string): string | null {
    const m = message.match(/Redundant tag "(@[^"]+)":/);
    return m?.[1] ?? null;
}
