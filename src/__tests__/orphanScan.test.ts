/**
 * Orphan scan completeness. The legacy count stays numeric.
 * It is shown only when the scan finished.
 */
import { describe, expect, it } from 'vitest';
import { createResolver } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { presentOrphanScan, summarizeSuiteMap, isSuiteMapHealthy } from '../core/map/suiteMap';
import type { Binding, FeatureStep } from '../core/domain/types';
import {
    suiteMapOrphanGroupMessage,
    suiteMapSummaryMessage,
} from '../features/suiteMap/suiteMapLabels';
import { en, es } from '../i18n/messages';
import { Range, Uri } from './mocks/vscode';

function binding(pattern: string, method: string, lineNumber: number): Binding {
    return {
        keyword: 'Given',
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'Steps',
        methodName: method,
        uri: Uri.file('/Steps.cs') as never,
        range: new Range(lineNumber, 0, lineNumber, 1) as never,
        lineNumber,
        signature: `Steps.${method}`,
        scopeTags: [],
    };
}

function step(text: string): FeatureStep {
    return {
        keywordOriginal: 'Given',
        keywordResolved: 'Given',
        rawText: text,
        normalizedText: text,
        fullText: `Given ${text}`,
        tagsEffective: [],
        uri: Uri.file('/a.feature') as never,
        range: new Range(1, 0, 1, 1) as never,
        lineNumber: 1,
        isOutline: false,
        candidateTexts: [text],
    };
}

function summarize(bindings: readonly Binding[], steps: readonly FeatureStep[], extra: { orphanScan?: 'unavailable'; orphanScanMax?: number; listCap?: number } = {}) {
    return summarizeSuiteMap({
        steps,
        bindings,
        resolve: createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (keyword) => bindings.filter((item) => item.keyword === keyword),
            preferSpecificBinding: false,
        }),
        featureCount: 1,
        ...extra,
    });
}

function fill(template: string, args: readonly string[]): string {
    return args.reduce((text, arg, index) => text.replace(`{${index}}`, arg), template);
}

describe('orphan scan completeness', () => {
    const used = binding('the clock is set', 'Used', 2);
    const unused = binding('the clock is spare', 'Spare', 8);

    it('shows a measured zero after a complete scan', () => {
        const summary = summarize([used], [step('the clock is set')]);
        expect(summary.orphanScan).toBe('complete');
        expect(summary.counts.orphanBindings).toBe(0);
        expect(presentOrphanScan(summary)).toEqual({ status: 'complete', orphanBindings: 0 });
        expect(isSuiteMapHealthy(summary)).toBe(true);
        const message = suiteMapSummaryMessage(summary);
        expect(fill(en[message.key], message.args)).toBe('1 bound · 0 unbound · 0 ambiguous · 0 orphan');
        expect(fill(es[message.key], message.args)).toBe('1 enlazados · 0 sin enlazar · 0 ambiguos · 0 huérfanos');
    });

    it('shows a measured orphan count and keeps the list cap', () => {
        const summary = summarize([used, unused], [step('the clock is set')], { listCap: 500 });
        expect(summary.orphanScan).toBe('complete');
        expect(summary.counts.orphanBindings).toBe(1);
        expect(summary.orphans).toHaveLength(1);
        expect(summary.orphansTruncated).toBe(0);
        expect(summary.counts.bound).toBe(1);
        const group = suiteMapOrphanGroupMessage(summary);
        expect(fill(en[group.key], group.args)).toBe('Orphans (1)');
        expect(fill(es[group.key], group.args)).toBe('Huérfanos (1)');
    });

    it('does not present the legacy zero when the scan is skipped', () => {
        const summary = summarize([used, unused], [step('the clock is set')], { orphanScanMax: 1 });
        expect(summary.orphanScan).toBe('skipped');
        expect(summary.orphansSkipped).toBe(true);
        expect(summary.counts.orphanBindings).toBe(0);
        expect(summary.orphans).toEqual([]);
        expect(presentOrphanScan(summary)).toEqual({ status: 'skipped' });
        expect(summary.counts.bound).toBe(1);
        expect(isSuiteMapHealthy(summary)).toBe(false);
        const message = suiteMapSummaryMessage(summary);
        const english = fill(en[message.key], message.args);
        const spanish = fill(es[message.key], message.args);
        expect(english).toBe('1 bound · 0 unbound · 0 ambiguous · orphan scan skipped');
        expect(spanish).toBe('1 enlazados · 0 sin enlazar · 0 ambiguos · escaneo de huérfanos omitido');
        expect(english).not.toMatch(/0 orphan/);
        expect(suiteMapOrphanGroupMessage(summary).key).toBe('suiteMapOrphansSkipped');
    });

    it('does not scan and does not present a count when the scan is unavailable', () => {
        const summary = summarize([unused], [], { orphanScan: 'unavailable', orphanScanMax: 0 });
        expect(summary.orphanScan).toBe('unavailable');
        expect(summary.orphansSkipped).toBe(false);
        expect(summary.counts.orphanBindings).toBe(0);
        expect(summary.orphans).toEqual([]);
        expect(presentOrphanScan(summary)).toEqual({ status: 'unavailable' });
        expect(isSuiteMapHealthy(summary)).toBe(false);
        const message = suiteMapSummaryMessage(summary);
        expect(fill(en[message.key], message.args)).toBe('0 bound · 0 unbound · 0 ambiguous · orphans unavailable');
        expect(fill(es[message.key], message.args)).toBe('0 enlazados · 0 sin enlazar · 0 ambiguos · huérfanos no disponibles');
        expect(suiteMapOrphanGroupMessage(summary).key).toBe('suiteMapOrphansUnavailable');
    });

    it('round-trips the summary and keeps a skipped zero out of the presentation', () => {
        const summary = summarize([unused], [], { orphanScanMax: 0 });
        const serialized = JSON.parse(JSON.stringify(summary)) as typeof summary;
        expect(serialized.orphanScan).toBe('skipped');
        expect(serialized.counts.orphanBindings).toBe(0);
        expect(serialized.counts.bound).toBe(0);
        expect(presentOrphanScan(serialized)).toEqual({ status: 'skipped' });
        expect(JSON.stringify(presentOrphanScan(serialized))).not.toContain('orphanBindings');
    });
});
