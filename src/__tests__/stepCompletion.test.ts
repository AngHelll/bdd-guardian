import { describe, expect, it } from 'vitest';
import {
    filterBindingsForCompletion,
    findPreviousStrongKeyword,
    humanizePatternForCompletion,
    parseStepCompletionLine,
    MAX_STEP_COMPLETIONS,
} from '../core/autocomplete';
import type { BindingCompletionSource } from '../core/autocomplete';

const fixtures: BindingCompletionSource[] = [
    {
        keyword: 'Given',
        patternRaw: 'the calculator is initialized',
        methodName: 'GivenTheCalculatorIsInitialized',
        filePath: 'StepDefinitions/SampleSteps.cs',
    },
    {
        keyword: 'Given',
        patternRaw: 'I have entered (\\d+) into the calculator',
        methodName: 'GivenIHaveEntered',
    },
    {
        keyword: 'When',
        patternRaw: '^I press "(.*)"$',
        methodName: 'WhenIPress',
    },
    {
        keyword: 'Then',
        patternRaw: 'I should see {string} in results',
        methodName: 'ThenIShouldSeeInResults',
    },
    {
        keyword: 'Given',
        patternRaw: 'I have {int} cucumbers',
        methodName: 'GivenIHaveCucumbers',
    },
];

describe('humanizePatternForCompletion', () => {
    it('strips anchors and replaces capture groups', () => {
        expect(humanizePatternForCompletion('^I press "(.*)"$')).toBe('I press "value"');
        expect(humanizePatternForCompletion('I have entered (\\d+) into the calculator')).toBe(
            'I have entered 1 into the calculator'
        );
    });

    it('expands cucumber expression placeholders', () => {
        expect(humanizePatternForCompletion('I have {int} cucumbers')).toBe('I have 1 cucumbers');
        expect(humanizePatternForCompletion('I should see {string} in results')).toBe(
            'I should see "value" in results'
        );
    });

    it('falls back to method phrase when still regex-like', () => {
        const body = humanizePatternForCompletion('[a-z]+\\d{2,}', 'MatchOddPattern');
        expect(body).toBe('match odd pattern');
    });
});

describe('parseStepCompletionLine', () => {
    it('rejects tables tags and comments', () => {
        expect(parseStepCompletionLine('    | col |').eligible).toBe(false);
        expect(parseStepCompletionLine('  @tag').eligible).toBe(false);
        expect(parseStepCompletionLine('  # comment').eligible).toBe(false);
    });

    it('parses Given with prefix body', () => {
        const ctx = parseStepCompletionLine('    Given the calc');
        expect(ctx.eligible).toBe(true);
        expect(ctx.keywordResolved).toBe('Given');
        expect(ctx.keywordPresent).toBe(true);
        expect(ctx.prefix).toBe('the calc');
        expect(ctx.bodyStartColumn).toBeGreaterThan(0);
    });

    it('And inherits previous strong keyword', () => {
        const ctx = parseStepCompletionLine('    And something', 'When');
        expect(ctx.keywordResolved).toBe('When');
    });
});

describe('findPreviousStrongKeyword', () => {
    it('walks upward past And/But', () => {
        expect(
            findPreviousStrongKeyword([
                '  Given foo',
                '  And bar',
                '  But baz',
            ])
        ).toBe('Given');
        expect(findPreviousStrongKeyword(['  When x'])).toBe('When');
    });
});

describe('filterBindingsForCompletion', () => {
    it('filters by keyword and prefix', () => {
        const items = filterBindingsForCompletion(fixtures, {
            keyword: 'Given',
            prefix: 'calculator',
            includeKeywordInInsert: false,
        });
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((i) => i.insertText.toLowerCase().includes('calculator') || i.patternRaw.includes('calculator') || i.methodName.toLowerCase().includes('calculator'))).toBe(true);
        expect(items.some((i) => i.patternRaw.includes('I press'))).toBe(false);
    });

    it('ranks startsWith before includes and respects limit', () => {
        const many: BindingCompletionSource[] = Array.from({ length: 50 }, (_, i) => ({
            keyword: 'Given' as const,
            patternRaw: `step number ${i} calculator extra`,
            methodName: `M${i}`,
        }));
        many.unshift({
            keyword: 'Given',
            patternRaw: 'calculator ready',
            methodName: 'Top',
        });
        const items = filterBindingsForCompletion(many, {
            keyword: 'Given',
            prefix: 'calculator',
            includeKeywordInInsert: false,
            limit: MAX_STEP_COMPLETIONS,
        });
        expect(items.length).toBeLessThanOrEqual(MAX_STEP_COMPLETIONS);
        expect(items[0].label.toLowerCase().startsWith('calculator')).toBe(true);
    });

    it('can prefix insert with keyword when requested', () => {
        const items = filterBindingsForCompletion(fixtures, {
            keyword: 'When',
            prefix: '',
            includeKeywordInInsert: true,
        });
        expect(items[0].insertText.startsWith('When ')).toBe(true);
    });
});
