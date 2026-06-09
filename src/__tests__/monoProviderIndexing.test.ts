import { describe, it, expect } from 'vitest';
import {
    formatIndexingModeLog,
    resolveProvidersToIndex,
} from '../core/index/providerIndexing';
import type { IBindingProvider, ProviderSelection } from '../providers/bindings/types';

function mockProvider(id: string, displayName: string, ext: string): IBindingProvider {
    return {
        id: id as IBindingProvider['id'],
        displayName,
        bindingFileExtensions: [ext],
        bindingGlob: `**/*.${ext.slice(1)}`,
        detect: async () => ({
            confidence: 0,
            reasons: [],
            signals: [],
            languages: [],
            primaryLanguages: [],
        }),
        indexBindings: async () => [],
        parseFile: () => [],
    };
}

function selection(
    active: IBindingProvider[],
    primary: IBindingProvider | null
): ProviderSelection {
    return {
        active,
        primary,
        report: [],
        detectedAt: new Date(),
    };
}

describe('resolveProvidersToIndex', () => {
    const csharp = mockProvider('csharp-reqnroll', 'C# Reqnroll', '.cs');
    const js = mockProvider('js-cucumber', 'JavaScript Cucumber', '.ts');

    it('returns all active providers in all mode', () => {
        const result = resolveProvidersToIndex(selection([csharp, js], csharp), 'all');
        expect(result.map((p) => p.id)).toEqual(['csharp-reqnroll', 'js-cucumber']);
    });

    it('returns only primary in primary mode', () => {
        const result = resolveProvidersToIndex(selection([csharp, js], csharp), 'primary');
        expect(result.map((p) => p.id)).toEqual(['csharp-reqnroll']);
    });

    it('returns empty in primary mode when primary is null', () => {
        const result = resolveProvidersToIndex(selection([csharp, js], null), 'primary');
        expect(result).toHaveLength(0);
    });

    it('falls back to primary in all mode when no active providers', () => {
        const result = resolveProvidersToIndex(selection([], js), 'all');
        expect(result.map((p) => p.id)).toEqual(['js-cucumber']);
    });
});

describe('formatIndexingModeLog', () => {
    const provider = mockProvider('js-cucumber', 'JavaScript Cucumber', '.ts');

    it('formats primary mode with provider name', () => {
        expect(formatIndexingModeLog('primary', [provider])).toBe(
            'primary (JavaScript Cucumber)'
        );
    });

    it('formats all mode with provider list', () => {
        expect(formatIndexingModeLog('all', [provider])).toBe('all (JavaScript Cucumber)');
    });
});
