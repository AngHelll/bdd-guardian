import { describe, expect, it } from 'vitest';
import {
    ambiguityI18n,
    explainAmbiguity,
    patternBreadthScore,
    truncateForDiagnostic,
    type AmbiguityBindingRef,
} from '../core/matching/ambiguityExplain';

function ref(
    methodName: string,
    patternRaw: string,
    score: number
): AmbiguityBindingRef {
    return { methodName, patternRaw, score };
}

describe('explainAmbiguity', () => {
    it('returns generic for fewer than 2 candidates', () => {
        const explanation = explainAmbiguity([ref('Only', 'foo', 10)]);
        expect(explanation.summaryKey).toBe('generic');
        expect(explanation.matchCount).toBe(1);
        expect(explanation.reasons).toHaveLength(0);
    });

    it('detects samePattern (duplicatePattern)', () => {
        const explanation = explainAmbiguity([
            ref('A', 'the result should be (.*) on the screen', 20),
            ref('B', 'the result should be (.*) on the screen', 15),
        ]);
        expect(explanation.summaryKey).toBe('duplicatePattern');
        expect(explanation.reasons[0]?.code).toBe('samePattern');
        expect(explanation.samePattern).toBe('the result should be (.*) on the screen');
        expect(ambiguityI18n(explanation).key).toBe('ambiguitySamePattern');
    });

    it('detects scoreTie when top scores are equal', () => {
        const explanation = explainAmbiguity([
            ref('A', 'pattern one (\\d+)', 12),
            ref('B', 'pattern two (.*)', 12),
        ]);
        expect(explanation.summaryKey).toBe('nearTies');
        expect(explanation.reasons[0]?.code).toBe('scoreTie');
        expect(explanation.tiedScore).toBe(12);
        expect(ambiguityI18n(explanation)).toEqual({
            key: 'ambiguityScoreTie',
            args: ['12'],
        });
    });

    it('detects broadVsSpecific for .* vs \\d+', () => {
        const broad = 'the result should be (.*) on the screen';
        const specific = 'the result should be (\\d+) on the screen';
        expect(patternBreadthScore(broad)).toBeGreaterThan(patternBreadthScore(specific));

        const explanation = explainAmbiguity([
            ref('Specific', specific, 30),
            ref('Broad', broad, 20),
        ]);
        expect(explanation.summaryKey).toBe('overlap');
        expect(explanation.reasons[0]?.code).toBe('broadVsSpecific');
        expect(explanation.broadPattern).toBe(broad);
        expect(explanation.specificPattern).toBe(specific);
        expect(ambiguityI18n(explanation).key).toBe('ambiguityBroadVsSpecific');
    });

    it('falls back to generic when patterns differ but breadth ties', () => {
        const explanation = explainAmbiguity([
            ref('A', 'alpha step text here', 10),
            ref('B', 'beta step text here!', 8),
        ]);
        // No wildcards; similar length → may be generic
        expect(['generic', 'overlap']).toContain(explanation.summaryKey);
        if (explanation.summaryKey === 'generic') {
            expect(ambiguityI18n(explanation).args[0]).toBe('2');
        }
    });

    it('truncateForDiagnostic caps long strings', () => {
        expect(truncateForDiagnostic('short')).toBe('short');
        expect(truncateForDiagnostic('x'.repeat(60), 48).length).toBe(48);
        expect(truncateForDiagnostic('x'.repeat(60), 48).endsWith('…')).toBe(true);
    });

    it('prefers samePattern over scoreTie', () => {
        const explanation = explainAmbiguity([
            ref('A', 'same', 5),
            ref('B', 'same', 5),
        ]);
        expect(explanation.summaryKey).toBe('duplicatePattern');
    });
});
