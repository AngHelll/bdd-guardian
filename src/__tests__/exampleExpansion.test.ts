/**
 * Tests for Scenario Outline Example expansion
 * Validates that steps with <placeholders> are correctly expanded
 * using values from Examples tables for proper binding matching.
 */
import { describe, it, expect } from 'vitest';
import {
    generateCandidateTexts,
    normalizeWhitespace,
    extractPlaceholders,
} from '../core/matching/normalization';
import { MAX_CANDIDATES_PER_STEP } from '../core/domain/constants';
import type { ExampleTable } from '../core/domain/types';

// Helper: core generateCandidateTexts(rawText, examples)
function getCandidates(stepText: string, examples?: ExampleTable[]): string[] {
    return generateCandidateTexts(stepText, examples);
}

function hasPlaceholders(stepText: string): boolean {
    return /<[^>]+>/.test(stepText);
}

// Helper to create examples for core (ExampleTable has headers, rows, tags)
function createExamples(tables: Array<{ headers: string[]; rows: string[][] }>): ExampleTable[] {
    return tables.map((e) => ({ headers: e.headers, rows: e.rows, tags: [] }));
}

describe('Example Expansion', () => {
    describe('generateCandidateTexts', () => {
        it('should return single candidate for regular step without placeholders', () => {
            const candidates = getCandidates('I click the submit button');
            expect(candidates).toHaveLength(1);
            expect(candidates[0]).toBe('I click the submit button');
        });

        it('should return fallback X candidate for outline step without examples', () => {
            const candidates = getCandidates('I enter <amount> in the field', []);
            expect(candidates).toHaveLength(1);
            expect(candidates[0]).toBe('I enter X in the field');
        });

        it('should expand single placeholder with example values', () => {
            const examples = createExamples([
                { headers: ['amount'], rows: [['50'], ['100'], ['200']] },
            ]);
            const candidates = getCandidates('I enter <amount> in the calculator', examples);
            expect(candidates).toContain('I enter X in the calculator'); // fallback
            expect(candidates).toContain('I enter 50 in the calculator');
            expect(candidates).toContain('I enter 100 in the calculator');
            expect(candidates).toContain('I enter 200 in the calculator');
            expect(candidates).toHaveLength(4);
        });

        it('should expand multiple placeholders from same row', () => {
            const examples = createExamples([
                { headers: ['first', 'second'], rows: [['10', '20'], ['5', '15']] },
            ]);
            const candidates = getCandidates('I add <first> and <second>', examples);
            expect(candidates).toContain('I add X and X'); // fallback
            expect(candidates).toContain('I add 10 and 20');
            expect(candidates).toContain('I add 5 and 15');
        });

        it('should handle placeholders inside quoted strings', () => {
            const examples = createExamples([
                {
                    headers: ['expected'],
                    rows: [['Hello World'], ['0'], ['Error: Invalid']],
                },
            ]);
            const candidates = getCandidates('the display shows "<expected>"', examples);
            expect(candidates).toContain('the display shows "X"'); // fallback
            expect(candidates).toContain('the display shows "Hello World"');
            expect(candidates).toContain('the display shows "0"');
            expect(candidates).toContain('the display shows "Error: Invalid"');
        });

        it('should handle numeric values for \\d+ bindings', () => {
            const examples = createExamples([
                { headers: ['number'], rows: [['50'], ['100'], ['999']] },
            ]);
            const candidates = getCandidates(
                'I have entered <number> into the calculator',
                examples
            );
            expect(candidates).toContain('I have entered 50 into the calculator');
            expect(candidates).toContain('I have entered 100 into the calculator');
            expect(candidates).toContain('I have entered 999 into the calculator');
        });

        it('should combine multiple Examples tables', () => {
            const examples = createExamples([
                { headers: ['status'], rows: [['active'], ['pending']] },
                { headers: ['status'], rows: [['deleted'], ['archived']] },
            ]);
            const candidates = getCandidates('the status should be "<status>"', examples);
            expect(candidates).toContain('the status should be "X"');
            expect(candidates).toContain('the status should be "active"');
            expect(candidates).toContain('the status should be "pending"');
            expect(candidates).toContain('the status should be "deleted"');
            expect(candidates).toContain('the status should be "archived"');
        });

        it('should limit candidates to MAX_CANDIDATES_PER_STEP', () => {
            const rows = Array.from({ length: 30 }, (_, i) => [`value${i}`]);
            const examples = createExamples([{ headers: ['val'], rows }]);
            const candidates = getCandidates('test <val>', examples);
            expect(candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES_PER_STEP);
            expect(candidates[0]).toBe('test X'); // fallback always first
        });

        it('should handle empty example values gracefully', () => {
            const examples = createExamples([
                { headers: ['val'], rows: [[''], ['something']] },
            ]);
            const candidates = getCandidates('the value is <val>', examples);
            expect(candidates).toContain('the value is X');
            expect(candidates.some((c) => c === 'the value is')).toBe(true);
            expect(candidates).toContain('the value is something');
        });

        it('should not create duplicate candidates', () => {
            const examples = createExamples([
                { headers: ['val'], rows: [['same'], ['same'], ['different']] },
            ]);
            const candidates = getCandidates('test <val>', examples);
            const sameCount = candidates.filter((c) => c === 'test same').length;
            expect(sameCount).toBe(1);
        });
    });

    describe('normalizeWhitespace', () => {
        it('should collapse multiple spaces to single space', () => {
            expect(normalizeWhitespace('hello    world')).toBe('hello world');
        });

        it('should convert tabs to spaces', () => {
            expect(normalizeWhitespace('hello\tworld')).toBe('hello world');
        });

        it('should trim leading and trailing whitespace', () => {
            expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
        });

        it('should handle mixed whitespace', () => {
            expect(normalizeWhitespace('  hello   \t\t  world  ')).toBe('hello world');
        });

        it('should preserve single spaces', () => {
            expect(normalizeWhitespace('hello world')).toBe('hello world');
        });

        it('should handle empty string', () => {
            expect(normalizeWhitespace('')).toBe('');
        });

        it('should preserve quotes and their contents', () => {
            expect(normalizeWhitespace('the message is "Hello World"')).toBe(
                'the message is "Hello World"'
            );
        });
    });

    describe('hasPlaceholders', () => {
        it('should detect <placeholder> patterns', () => {
            expect(hasPlaceholders('I enter <amount>')).toBe(true);
            expect(hasPlaceholders('I enter <first> and <second>')).toBe(true);
        });

        it('should return false for steps without placeholders', () => {
            expect(hasPlaceholders('I click the button')).toBe(false);
            expect(hasPlaceholders('the value is 123')).toBe(false);
        });

        it('should not match incomplete angle brackets', () => {
            expect(hasPlaceholders('a < b')).toBe(false);
            expect(hasPlaceholders('a > b')).toBe(false);
        });
    });

    describe('extractPlaceholders', () => {
        it('should extract placeholder names', () => {
            expect(extractPlaceholders('I enter <amount>')).toEqual(['amount']);
            expect(extractPlaceholders('I add <first> and <second>')).toEqual([
                'first',
                'second',
            ]);
        });

        it('should return empty array for no placeholders', () => {
            expect(extractPlaceholders('I click the button')).toEqual([]);
        });

        it('should handle underscores in placeholder names', () => {
            expect(extractPlaceholders('the <expected_value> is shown')).toEqual([
                'expected_value',
            ]);
        });
    });
});

describe('Real-world Scenario Outline examples', () => {
    it('should match crypto variation step with examples', () => {
        const examples = createExamples([
            {
                headers: ['currency', 'time_period', 'expected_currency'],
                rows: [
                    ['MXN', 'one_day', 'mxn'],
                    ['USD', 'one_day', 'usd'],
                    ['MXN', 'one_week', 'mxn'],
                ],
            },
        ]);
        const candidates = getCandidates(
            'I retrieve crypto variation for currency "<currency>" and time period "<time_period>"',
            examples
        );
        expect(candidates).toContain(
            'I retrieve crypto variation for currency "MXN" and time period "one_day"'
        );
        expect(candidates).toContain(
            'I retrieve crypto variation for currency "USD" and time period "one_day"'
        );
        expect(candidates).toContain(
            'I retrieve crypto variation for currency "MXN" and time period "one_week"'
        );
    });

    it('should match delete account step with status code', () => {
        const examples = createExamples([
            { headers: ['status'], rows: [['204'], ['400'], ['404']] },
        ]);
        const candidates = getCandidates('I delete account <status>', examples);
        expect(candidates).toContain('I delete account 204');
        expect(candidates).toContain('I delete account 400');
        expect(candidates).toContain('I delete account 404');
    });

    it('should match PPR income step', () => {
        const examples = createExamples([
            { headers: ['income'], rows: [['50000'], ['100000'], ['150000']] },
        ]);
        const candidates = getCandidates(
            'I should get comprehensive profile result for income <income>',
            examples
        );
        expect(candidates).toContain(
            'I should get comprehensive profile result for income 50000'
        );
        expect(candidates).toContain(
            'I should get comprehensive profile result for income 100000'
        );
    });
});
