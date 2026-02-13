/**
 * Tests for Scenario Outline Example expansion
 * Validates that steps with <placeholders> are correctly expanded
 * using values from Examples tables for proper binding matching.
 */
import { describe, it, expect } from 'vitest';
import { 
    generateCandidateTexts, 
    normalizeWhitespace, 
    hasPlaceholders,
    extractPlaceholders 
} from '../indexers/featureIndexer';
import { Uri, Range } from './mocks/vscode';

// Helper to create a mock step with examples
function createOutlineStep(
    stepText: string,
    examples: Array<{ headers: string[], rows: string[][] }>
) {
    return {
        keywordOriginal: 'When' as const,
        keywordResolved: 'When' as const,
        stepText,
        fullText: `When ${stepText}`,
        tagsInScope: [],
        uri: Uri.file('/test/feature.feature') as any,
        range: new Range(0, 0, 0, 0) as any,
        lineNumber: 0,
        scenarioName: 'Test Outline',
        examples: examples.map(e => ({ ...e, tags: [] })),
    };
}

// Helper to create a regular step (no examples)
function createRegularStep(stepText: string) {
    return {
        keywordOriginal: 'When' as const,
        keywordResolved: 'When' as const,
        stepText,
        fullText: `When ${stepText}`,
        tagsInScope: [],
        uri: Uri.file('/test/feature.feature') as any,
        range: new Range(0, 0, 0, 0) as any,
        lineNumber: 0,
        scenarioName: 'Test Scenario',
        examples: undefined,
    };
}

describe('Example Expansion', () => {
    describe('generateCandidateTexts', () => {
        it('should return single candidate for regular step without placeholders', () => {
            const step = createRegularStep('I click the submit button');
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toHaveLength(1);
            expect(candidates[0]).toBe('I click the submit button');
        });

        it('should return fallback X candidate for outline step without examples', () => {
            const step = createOutlineStep('I enter <amount> in the field', []);
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toHaveLength(1);
            expect(candidates[0]).toBe('I enter X in the field');
        });

        it('should expand single placeholder with example values', () => {
            const step = createOutlineStep('I enter <amount> in the calculator', [
                { headers: ['amount'], rows: [['50'], ['100'], ['200']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toContain('I enter X in the calculator');  // fallback
            expect(candidates).toContain('I enter 50 in the calculator');
            expect(candidates).toContain('I enter 100 in the calculator');
            expect(candidates).toContain('I enter 200 in the calculator');
            expect(candidates).toHaveLength(4);
        });

        it('should expand multiple placeholders from same row', () => {
            const step = createOutlineStep('I add <first> and <second>', [
                { headers: ['first', 'second'], rows: [['10', '20'], ['5', '15']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toContain('I add X and X');  // fallback
            expect(candidates).toContain('I add 10 and 20');
            expect(candidates).toContain('I add 5 and 15');
        });

        it('should handle placeholders inside quoted strings', () => {
            const step = createOutlineStep('the display shows "<expected>"', [
                { headers: ['expected'], rows: [['Hello World'], ['0'], ['Error: Invalid']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toContain('the display shows "X"');  // fallback
            expect(candidates).toContain('the display shows "Hello World"');
            expect(candidates).toContain('the display shows "0"');
            expect(candidates).toContain('the display shows "Error: Invalid"');
        });

        it('should handle numeric values for \\d+ bindings', () => {
            const step = createOutlineStep('I have entered <number> into the calculator', [
                { headers: ['number'], rows: [['50'], ['100'], ['999']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            // These should match binding pattern: I have entered (\d+) into the calculator
            expect(candidates).toContain('I have entered 50 into the calculator');
            expect(candidates).toContain('I have entered 100 into the calculator');
            expect(candidates).toContain('I have entered 999 into the calculator');
        });

        it('should combine multiple Examples tables', () => {
            const step = createOutlineStep('the status should be "<status>"', [
                { headers: ['status'], rows: [['active'], ['pending']] },
                { headers: ['status'], rows: [['deleted'], ['archived']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toContain('the status should be "X"');
            expect(candidates).toContain('the status should be "active"');
            expect(candidates).toContain('the status should be "pending"');
            expect(candidates).toContain('the status should be "deleted"');
            expect(candidates).toContain('the status should be "archived"');
        });

        it('should limit candidates to MAX_CANDIDATES_PER_STEP', () => {
            // Create 30 rows, should be limited
            const rows = Array.from({ length: 30 }, (_, i) => [`value${i}`]);
            const step = createOutlineStep('test <val>', [
                { headers: ['val'], rows }
            ]);
            const candidates = generateCandidateTexts(step);
            
            // Should be capped (fallback + up to 24 rows = 25 max)
            expect(candidates.length).toBeLessThanOrEqual(25);
            expect(candidates[0]).toBe('test X');  // fallback always first
        });

        it('should handle empty example values gracefully', () => {
            const step = createOutlineStep('the value is <val>', [
                { headers: ['val'], rows: [[''], ['something']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            expect(candidates).toContain('the value is X');
            // Empty value creates 'the value is' which is different from fallback 'the value is X'
            expect(candidates.some(c => c === 'the value is')).toBe(true);
            expect(candidates).toContain('the value is something');
        });

        it('should not create duplicate candidates', () => {
            const step = createOutlineStep('test <val>', [
                { headers: ['val'], rows: [['same'], ['same'], ['different']] }
            ]);
            const candidates = generateCandidateTexts(step);
            
            const sameCount = candidates.filter(c => c === 'test same').length;
            expect(sameCount).toBe(1);  // Only one 'test same'
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
            expect(normalizeWhitespace('the message is "Hello World"')).toBe('the message is "Hello World"');
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
            expect(extractPlaceholders('I add <first> and <second>')).toEqual(['first', 'second']);
        });

        it('should return empty array for no placeholders', () => {
            expect(extractPlaceholders('I click the button')).toEqual([]);
        });

        it('should handle underscores in placeholder names', () => {
            expect(extractPlaceholders('the <expected_value> is shown')).toEqual(['expected_value']);
        });
    });
});

describe('Real-world Scenario Outline examples', () => {
    it('should match crypto variation step with examples', () => {
        // Real example from GBM project
        const step = createOutlineStep(
            'I retrieve crypto variation for currency "<currency>" and time period "<time_period>"',
            [{
                headers: ['currency', 'time_period', 'expected_currency'],
                rows: [
                    ['MXN', 'one_day', 'mxn'],
                    ['USD', 'one_day', 'usd'],
                    ['MXN', 'one_week', 'mxn'],
                ]
            }]
        );
        const candidates = generateCandidateTexts(step);
        
        // Should have expanded candidates that match the binding:
        // [When(@"I retrieve crypto variation for currency ""(.*)"" and time period ""(.*)""")]
        expect(candidates).toContain('I retrieve crypto variation for currency "MXN" and time period "one_day"');
        expect(candidates).toContain('I retrieve crypto variation for currency "USD" and time period "one_day"');
        expect(candidates).toContain('I retrieve crypto variation for currency "MXN" and time period "one_week"');
    });

    it('should match delete account step with status code', () => {
        const step = createOutlineStep('I delete account <status>', [
            { headers: ['status'], rows: [['204'], ['400'], ['404']] }
        ]);
        const candidates = generateCandidateTexts(step);
        
        // Should match binding: [Then(@"I delete account (.*)")]
        expect(candidates).toContain('I delete account 204');
        expect(candidates).toContain('I delete account 400');
        expect(candidates).toContain('I delete account 404');
    });

    it('should match PPR income step', () => {
        const step = createOutlineStep(
            'I should get comprehensive profile result for income <income>',
            [{ headers: ['income'], rows: [['50000'], ['100000'], ['150000']] }]
        );
        const candidates = generateCandidateTexts(step);
        
        // Should match binding: [Then("I should get comprehensive profile result for income (.*)")]
        expect(candidates).toContain('I should get comprehensive profile result for income 50000');
        expect(candidates).toContain('I should get comprehensive profile result for income 100000');
    });
});
