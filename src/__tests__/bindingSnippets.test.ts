import { describe, it, expect } from 'vitest';
import {
    buildUnboundBindingSnippet,
    getPreviewFenceLanguage,
    resolveHoverFrameworkContext,
    suggestBindingPattern,
} from '../features/hovers/bindingSnippets';
import type { BindingProviderId, ProviderSelection } from '../providers/bindings/types';

function mockSelection(primaryId: BindingProviderId, displayName: string, confidence = 0.9): ProviderSelection {
    return {
        primary: { id: primaryId, displayName } as ProviderSelection['primary'],
        active: [],
        report: [{ id: primaryId, displayName, confidence, reasons: [], signals: [] }],
        detectedAt: new Date(),
    };
}

describe('resolveHoverFrameworkContext', () => {
    it('uses primary provider when no binding uri', () => {
        const ctx = resolveHoverFrameworkContext({
            selection: mockSelection('js-cucumber', 'JavaScript Cucumber'),
        });
        expect(ctx.snippetKind).toBe('js-cucumber');
        expect(ctx.displayName).toBe('JavaScript Cucumber');
    });

    it('infers js-cucumber from .ts binding path', () => {
        const ctx = resolveHoverFrameworkContext({
            selection: mockSelection('csharp-reqnroll', 'C# Reqnroll'),
            bindingUriPath: '/proj/steps/login.steps.ts',
        });
        expect(ctx.snippetKind).toBe('js-cucumber');
    });

    it('falls back to generic C# when selection is null', () => {
        const ctx = resolveHoverFrameworkContext({ selection: null });
        expect(ctx.snippetKind).toBe('generic-csharp-fallback');
    });
});

describe('buildUnboundBindingSnippet', () => {
    it('produces C# attribute snippet', () => {
        const s = buildUnboundBindingSnippet('csharp-reqnroll', 'When', 'I click (.*)');
        expect(s.fenceLanguage).toBe('csharp');
        expect(s.code).toContain('[When(@"I click (.*)")');
    });

    it('produces Cucumber.js snippet', () => {
        const s = buildUnboundBindingSnippet('js-cucumber', 'Given', 'I have (\\d+) items');
        expect(s.fenceLanguage).toBe('typescript');
        expect(s.code).toContain("Given('I have (\\d+) items', function");
    });

    it('produces Java snippet', () => {
        const s = buildUnboundBindingSnippet('java-cucumber', 'Then', 'I see (.*)');
        expect(s.fenceLanguage).toBe('java');
        expect(s.code).toContain('@Then("I see (.*)")');
    });

    it('produces Behave snippet', () => {
        const s = buildUnboundBindingSnippet('python-behave', 'When', 'I search');
        expect(s.fenceLanguage).toBe('python');
        expect(s.code).toContain("@when('I search')");
    });

    it('produces Godog snippet with InitializeScenario comment', () => {
        const s = buildUnboundBindingSnippet('go-godog', 'Given', 'there are (\\d+) items');
        expect(s.fenceLanguage).toBe('go');
        expect(s.code).toContain('InitializeScenario');
        expect(s.code).toContain('ctx.Given');
    });
});

describe('getPreviewFenceLanguage', () => {
    it('maps extensions to fence languages', () => {
        expect(getPreviewFenceLanguage('/a/Bindings.cs')).toBe('csharp');
        expect(getPreviewFenceLanguage('/a/steps.ts')).toBe('typescript');
        expect(getPreviewFenceLanguage('/a/Steps.java')).toBe('java');
        expect(getPreviewFenceLanguage('/a/steps.py')).toBe('python');
        expect(getPreviewFenceLanguage('/a/steps.go')).toBe('go');
    });
});

describe('suggestBindingPattern', () => {
    it('replaces numeric literals with digit capture group', () => {
        expect(suggestBindingPattern('I have 5 items')).toContain('(\\d+)');
    });
});
