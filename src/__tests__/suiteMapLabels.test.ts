import { describe, expect, it } from 'vitest';
import {
    formatSuiteMapHoleDescription,
    formatSuiteMapHoleLabel,
} from '../features/suiteMap/suiteMapLabels';

describe('suite map hole rows', () => {
    it('keeps the step text as the label, without a line prefix', () => {
        const text = 'I enter valid credentials';
        expect(formatSuiteMapHoleLabel(text)).toBe(text);
        expect(formatSuiteMapHoleLabel(text)).not.toContain('—');
    });

    it('puts the 1-based line in the description', () => {
        expect(formatSuiteMapHoleDescription(11)).toBe('L12');
        expect(formatSuiteMapHoleDescription(0)).toBe('L1');
    });

    it('keeps the ambiguous candidate count beside the line', () => {
        expect(formatSuiteMapHoleDescription(11, 3)).toBe('L12 · 3');
    });

    it('uses the binding pattern as the orphan label', () => {
        const pattern = 'the user is valid';
        expect(formatSuiteMapHoleLabel(pattern)).toBe(pattern);
        expect(formatSuiteMapHoleDescription(4)).toBe('L5');
    });
});
