import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => {
    const mocks = await import('./mocks/vscode');
    return {
        ...mocks,
        workspace: {
            ...mocks.workspace,
            getConfiguration: vi.fn(() => ({
                get: (key: string, defaultValue?: unknown) => {
                    if (key === 'displayLanguage') {
                        return (globalThis as { __testLang?: string }).__testLang ?? 'en';
                    }
                    return defaultValue;
                },
            })),
        },
    };
});

import {
    StepStatus,
    formatBoundCodeLensTitle,
    getAmbiguousStatusLabel,
    getStatusLabel,
} from '../ui/stepStatus';
import { refreshLanguage } from '../i18n';

describe('getStatusLabel', () => {
    beforeEach(() => {
        (globalThis as { __testLang?: string }).__testLang = 'en';
        refreshLanguage();
    });

    it('returns English labels by default', () => {
        expect(getStatusLabel(StepStatus.Bound)).toBe('Bound');
        expect(getStatusLabel(StepStatus.Unbound)).toBe('Unbound');
        expect(getStatusLabel(StepStatus.Ambiguous)).toBe('Ambiguous');
        expect(getStatusLabel(StepStatus.Indexing)).toBe('Indexing...');
    });

    it('returns Spanish labels when displayLanguage is es', () => {
        (globalThis as { __testLang?: string }).__testLang = 'es';
        refreshLanguage();

        expect(getStatusLabel(StepStatus.Bound)).toBe('Vinculado');
        expect(getStatusLabel(StepStatus.Unbound)).toBe('Sin vincular');
        expect(getStatusLabel(StepStatus.Ambiguous)).toBe('Ambiguo');
        expect(getStatusLabel(StepStatus.Indexing)).toBe('Indexando…');
    });

    it('formats ambiguous gutter label with count', () => {
        expect(getAmbiguousStatusLabel(3)).toBe('Ambiguous (3 matches)');
    });
});

describe('formatBoundCodeLensTitle', () => {
    it('omits score when showMatchScore is false', () => {
        expect(formatBoundCodeLensTitle('SampleSteps', 'GivenValidUser', 120, false)).toBe(
            'SampleSteps.GivenValidUser'
        );
    });

    it('includes score when showMatchScore is true', () => {
        expect(formatBoundCodeLensTitle('SampleSteps', 'GivenValidUser', 120, true)).toBe(
            'SampleSteps.GivenValidUser (120)'
        );
    });
});
