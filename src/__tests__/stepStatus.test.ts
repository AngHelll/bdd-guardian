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
    getCodeLensIcon,
    getStatusLabel,
    stepStatusFromResolve,
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

        expect(getStatusLabel(StepStatus.Bound)).toBe('Enlazado');
        expect(getStatusLabel(StepStatus.Unbound)).toBe('Sin enlazar');
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

describe('getCodeLensIcon', () => {
    it('maps bound to check and ambiguous to warning', () => {
        expect(getCodeLensIcon(StepStatus.Bound)).toBe('$(check)');
        expect(getCodeLensIcon(StepStatus.Unbound)).toBe('$(error)');
        expect(getCodeLensIcon(StepStatus.Ambiguous)).toBe('$(warning)');
    });
});

describe('stepStatusFromResolve', () => {
    it('maps resolver status strings', () => {
        expect(stepStatusFromResolve('bound')).toBe(StepStatus.Bound);
        expect(stepStatusFromResolve('ambiguous')).toBe(StepStatus.Ambiguous);
        expect(stepStatusFromResolve('unbound')).toBe(StepStatus.Unbound);
    });
});
