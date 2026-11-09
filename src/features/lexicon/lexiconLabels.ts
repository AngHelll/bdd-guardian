/**
 * Labels for the step lexicon. Counts come from buildLexicon; this file only formats them.
 */

import type { Lexicon, LexiconRow } from '../../core/lexicon/lexicon';
import { t } from '../../i18n';

export function formatLexiconUsageCount(count: number): string {
    if (count === 0) {
        return t('lexiconNoUsages');
    }
    if (count === 1) {
        return t('lexiconUsageOne');
    }
    return t('lexiconUsages', String(count));
}

export function formatLexiconWordDescription(row: LexiconRow): string {
    if (row.speakers === undefined) {
        if (row.implementations.length === 1) {
            return row.implementations[0].signature;
        }
        return t('lexiconImplementations', String(row.implementations.length));
    }
    if (row.speakers.length === 0) {
        return t('lexiconNoUsages');
    }
    const uses = formatLexiconUsageCount(row.speakers.length);
    if (row.implementations.length === 1) {
        return `${uses} · ${row.implementations[0].signature}`;
    }
    return `${uses} · ${t('lexiconImplementations', String(row.implementations.length))}`;
}

export function formatLexiconSummary(lexicon: Lexicon): string {
    if (lexicon.usagesSkipped) {
        return t('lexiconSummarySkipped', String(lexicon.counts.words));
    }
    return t(
        'lexiconSummary',
        String(lexicon.counts.words),
        String(lexicon.counts.usages),
        String(lexicon.counts.unused),
        String(lexicon.counts.multi)
    );
}
