/**
 * Ambiguity Detection Tests - Validate correct identification of ambiguous bindings.
 * 
 * Ensures:
 * - Multiple matching bindings are correctly detected
 * - Ambiguity is reported when patterns overlap
 * - Best match is selected from ambiguous candidates
 */

import { describe, it, expect } from 'vitest';
import { compileBindingRegex } from '../core/parsing/bindingRegex';

interface MockBinding {
    methodName: string;
    pattern: string;
    regex: RegExp | null;
}

describe('Ambiguity Detection', () => {
    describe('overlapping patterns', () => {
        it('should detect ambiguity between generic and specific patterns', () => {
            const bindings: MockBinding[] = [
                { methodName: 'ThenTheResultShouldBe', pattern: 'the result should be (.*) on the screen', regex: null },
                { methodName: 'ThenTheResultShouldBeNumeric', pattern: 'the result should be (\\d+) on the screen', regex: null },
            ];
            
            // Compile regexes
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'the result should be 25 on the screen';
            
            const matches = bindings.filter(b => b.regex?.test(stepText));
            
            // Both should match - this is an ambiguity
            expect(matches).toHaveLength(2);
            expect(matches.map(m => m.methodName)).toContain('ThenTheResultShouldBe');
            expect(matches.map(m => m.methodName)).toContain('ThenTheResultShouldBeNumeric');
        });
        
        it('should detect ambiguity in crypto variation patterns', () => {
            const bindings: MockBinding[] = [
                { 
                    methodName: 'WhenIRetrieveCryptoVariation', 
                    pattern: 'I retrieve crypto variation for currency "([^"]+)" and time period "([^"]+)"', 
                    regex: null 
                },
                { 
                    methodName: 'WhenIAttemptToRetrieveCryptoVariation', 
                    pattern: 'I attempt to retrieve crypto variation (.+)', 
                    regex: null 
                },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            // This step should only match the first pattern
            const step1 = 'I retrieve crypto variation for currency "MXN" and time period "one_day"';
            const matches1 = bindings.filter(b => b.regex?.test(step1));
            expect(matches1).toHaveLength(1);
            expect(matches1[0].methodName).toBe('WhenIRetrieveCryptoVariation');
            
            // This step should match the second pattern
            const step2 = 'I attempt to retrieve crypto variation without time period';
            const matches2 = bindings.filter(b => b.regex?.test(step2));
            expect(matches2).toHaveLength(1);
            expect(matches2[0].methodName).toBe('WhenIAttemptToRetrieveCryptoVariation');
        });
        
        it('should detect ambiguity with calculator example', () => {
            const bindings: MockBinding[] = [
                { methodName: 'GivenIHaveEntered', pattern: 'I have entered (\\d+) into the calculator', regex: null },
                { methodName: 'GivenIHaveEnteredAnything', pattern: 'I have entered (.*) into the calculator', regex: null },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'I have entered 100 into the calculator';
            
            const matches = bindings.filter(b => b.regex?.test(stepText));
            
            // Both should match
            expect(matches).toHaveLength(2);
        });
    });
    
    describe('non-ambiguous patterns', () => {
        it('should not detect ambiguity when patterns are distinct', () => {
            const bindings: MockBinding[] = [
                { methodName: 'GivenCalculatorInitialized', pattern: 'the calculator is initialized', regex: null },
                { methodName: 'GivenDisplayShows', pattern: 'the display shows "([^"]*)"', regex: null },
                { methodName: 'WhenIPress', pattern: 'I press "([^"]+)"', regex: null },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'the calculator is initialized';
            const matches = bindings.filter(b => b.regex?.test(stepText));
            
            // Only one should match
            expect(matches).toHaveLength(1);
            expect(matches[0].methodName).toBe('GivenCalculatorInitialized');
        });
        
        it('should correctly match PPR projection pattern without ambiguity', () => {
            const bindings: MockBinding[] = [
                { 
                    methodName: 'WhenIRequestPortfolioProjection', 
                    pattern: 'I request portfolio projection for (debt|balance|growth|settlement|preservation|appreciation|equities) with investment time (\\d+) years, first deposit (\\d+), and monthly deposit (\\d+)', 
                    regex: null 
                },
                { 
                    methodName: 'ThenIShouldGetValidResponse', 
                    pattern: 'I should get a valid portfolio projection response', 
                    regex: null 
                },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'I request portfolio projection for debt with investment time 5 years, first deposit 1000, and monthly deposit 1000';
            const matches = bindings.filter(b => b.regex?.test(stepText));
            
            // Only one should match
            expect(matches).toHaveLength(1);
            expect(matches[0].methodName).toBe('WhenIRequestPortfolioProjection');
        });
    });
    
    describe('best match selection', () => {
        it('should select more specific pattern as best match', () => {
            const bindings: MockBinding[] = [
                { methodName: 'Generic', pattern: 'I have entered (.*) into the calculator', regex: null },
                { methodName: 'Specific', pattern: 'I have entered (\\d+) into the calculator', regex: null },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'I have entered 50 into the calculator';
            
            // Score each match
            const candidates = bindings
                .filter(b => b.regex?.test(stepText))
                .map(b => ({
                    binding: b,
                    score: scoreBinding(b.pattern),
                }))
                .sort((a, b) => b.score - a.score);
            
            // Best should be the specific \d+ pattern
            expect(candidates[0].binding.methodName).toBe('Specific');
        });
        
        it('should prefer exact alternation over wildcard', () => {
            const bindings: MockBinding[] = [
                { methodName: 'Wildcard', pattern: 'I request (.+) portfolio', regex: null },
                { methodName: 'Alternation', pattern: 'I request (debt|growth|balance) portfolio', regex: null },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'I request debt portfolio';
            
            const candidates = bindings
                .filter(b => b.regex?.test(stepText))
                .map(b => ({
                    binding: b,
                    score: scoreBinding(b.pattern),
                }))
                .sort((a, b) => b.score - a.score);
            
            // Both should match
            expect(candidates).toHaveLength(2);
            
            // Alternation should win
            expect(candidates[0].binding.methodName).toBe('Alternation');
        });
    });
    
    describe('edge cases', () => {
        it('should handle empty bindings list', () => {
            const bindings: MockBinding[] = [];
            const stepText = 'any step text';
            
            const matches = bindings.filter(b => b.regex?.test(stepText));
            expect(matches).toHaveLength(0);
        });
        
        it('should handle step that matches no bindings', () => {
            const bindings: MockBinding[] = [
                { methodName: 'SomeBinding', pattern: 'specific pattern only', regex: null },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            const stepText = 'completely different text';
            const matches = bindings.filter(b => b.regex?.test(stepText));
            
            expect(matches).toHaveLength(0);
        });
        
        it('should handle patterns with special regex characters', () => {
            const bindings: MockBinding[] = [
                { methodName: 'WithDot', pattern: 'file\\.txt is created', regex: null },
                { methodName: 'WithQuestion', pattern: 'is this correct\\?', regex: null },
            ];
            
            bindings.forEach(b => {
                b.regex = compileBindingRegex(b.pattern);
            });
            
            expect(bindings[0].regex?.test('file.txt is created')).toBe(true);
            expect(bindings[0].regex?.test('filetxt is created')).toBe(false);
            
            expect(bindings[1].regex?.test('is this correct?')).toBe(true);
            expect(bindings[1].regex?.test('is this correct')).toBe(false);
        });
    });
});

/**
 * Simple scoring function for testing best match selection.
 */
function scoreBinding(pattern: string): number {
    let score = 100;
    
    // Bonus for typed captures
    const typedCaptures = (pattern.match(/\\d\+|\\w\+|\[\^"\]/g) || []).length;
    score += typedCaptures * 10;
    
    // Penalty for wildcards
    const wildcards = (pattern.match(/\.\+|\.\*/g) || []).length;
    score -= wildcards * 15;
    
    // Bonus for alternation (specific options)
    const alternations = (pattern.match(/\|/g) || []).length;
    score += alternations * 5;
    
    // Bonus for literal text
    const literalLength = pattern.replace(/\([^)]+\)/g, '').replace(/[\\^$.*+?{}[\]|]/g, '').length;
    score += Math.min(literalLength, 50);
    
    return score;
}
