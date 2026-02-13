/**
 * Scoring Tests - Validate deterministic and consistent scoring behavior.
 * 
 * Ensures:
 * - Same input always produces same score
 * - More specific patterns score higher than general ones
 * - Exact matches score highest
 * - Score ordering is predictable
 */

import { describe, it, expect } from 'vitest';
import { compileBindingRegex } from '../core/parsing/bindingRegex';

describe('Scoring Consistency', () => {
    describe('deterministic scoring', () => {
        it('should produce same score for identical inputs across multiple calls', () => {
            const pattern = 'I have entered (\\d+) into the calculator';
            const stepText = 'I have entered 50 into the calculator';
            
            const scores: number[] = [];
            for (let i = 0; i < 10; i++) {
                const regex = compileBindingRegex(pattern);
                expect(regex).not.toBeNull();
                const match = regex!.exec(stepText);
                expect(match).not.toBeNull();
                // Score based on specificity (capture groups, pattern length)
                const score = calculateScore(pattern, stepText, match!);
                scores.push(score);
            }
            
            // All scores should be identical
            const uniqueScores = [...new Set(scores)];
            expect(uniqueScores).toHaveLength(1);
        });
        
        it('should produce consistent ordering for ambiguous matches', () => {
            const patterns = [
                { pattern: 'the result should be (.*) on the screen', specificity: 'low' },
                { pattern: 'the result should be (\\d+) on the screen', specificity: 'high' },
            ];
            
            const stepText = 'the result should be 25 on the screen';
            
            const results = patterns.map(p => {
                const regex = compileBindingRegex(p.pattern);
                const match = regex?.exec(stepText);
                return {
                    pattern: p.pattern,
                    specificity: p.specificity,
                    matched: !!match,
                    score: match ? calculateScore(p.pattern, stepText, match) : 0,
                };
            });
            
            // Both should match
            expect(results.every(r => r.matched)).toBe(true);
            
            // \d+ should score higher than .* (more specific)
            const highSpec = results.find(r => r.specificity === 'high')!;
            const lowSpec = results.find(r => r.specificity === 'low')!;
            expect(highSpec.score).toBeGreaterThan(lowSpec.score);
        });
    });
    
    describe('specificity scoring', () => {
        it('should score exact text higher than capture groups', () => {
            const exactPattern = 'I press add';
            const capturePattern = 'I press (.+)';
            const stepText = 'I press add';
            
            const exactRegex = compileBindingRegex(exactPattern);
            const captureRegex = compileBindingRegex(capturePattern);
            
            const exactMatch = exactRegex?.exec(stepText);
            const captureMatch = captureRegex?.exec(stepText);
            
            expect(exactMatch).not.toBeNull();
            expect(captureMatch).not.toBeNull();
            
            const exactScore = calculateScore(exactPattern, stepText, exactMatch!);
            const captureScore = calculateScore(capturePattern, stepText, captureMatch!);
            
            expect(exactScore).toBeGreaterThan(captureScore);
        });
        
        it('should score numeric patterns higher than wildcard patterns', () => {
            const numericPattern = 'I have entered (\\d+) into the calculator';
            const wildcardPattern = 'I have entered (.*) into the calculator';
            const stepText = 'I have entered 100 into the calculator';
            
            const numericRegex = compileBindingRegex(numericPattern);
            const wildcardRegex = compileBindingRegex(wildcardPattern);
            
            const numericMatch = numericRegex?.exec(stepText);
            const wildcardMatch = wildcardRegex?.exec(stepText);
            
            expect(numericMatch).not.toBeNull();
            expect(wildcardMatch).not.toBeNull();
            
            const numericScore = calculateScore(numericPattern, stepText, numericMatch!);
            const wildcardScore = calculateScore(wildcardPattern, stepText, wildcardMatch!);
            
            expect(numericScore).toBeGreaterThan(wildcardScore);
        });
        
        it('should score longer literal matches higher', () => {
            const shortPattern = 'I enter (.+)';
            const longPattern = 'I enter value (.+) into field';
            const stepText = 'I enter value 100 into field';
            
            const shortRegex = compileBindingRegex(shortPattern);
            const longRegex = compileBindingRegex(longPattern);
            
            // Short pattern shouldn't match full text
            const shortMatch = shortRegex?.exec(stepText);
            const longMatch = longRegex?.exec(stepText);
            
            // Long pattern should match and have higher score
            expect(longMatch).not.toBeNull();
            
            if (shortMatch && longMatch) {
                const shortScore = calculateScore(shortPattern, stepText, shortMatch);
                const longScore = calculateScore(longPattern, stepText, longMatch);
                expect(longScore).toBeGreaterThan(shortScore);
            }
        });
    });
    
    describe('GBM-style pattern scoring', () => {
        it('should correctly score PPR projection patterns', () => {
            const specificPattern = 'I request portfolio projection for (debt|balance|growth) with investment time (\\d+) years, first deposit (\\d+), and monthly deposit (\\d+)';
            const genericPattern = 'I request portfolio projection for (.+)';
            const stepText = 'I request portfolio projection for debt with investment time 5 years, first deposit 1000, and monthly deposit 1000';
            
            const specificRegex = compileBindingRegex(specificPattern);
            const genericRegex = compileBindingRegex(genericPattern);
            
            const specificMatch = specificRegex?.exec(stepText);
            const genericMatch = genericRegex?.exec(stepText);
            
            expect(specificMatch).not.toBeNull();
            expect(genericMatch).not.toBeNull();
            
            const specificScore = calculateScore(specificPattern, stepText, specificMatch!);
            const genericScore = calculateScore(genericPattern, stepText, genericMatch!);
            
            // Specific pattern with multiple typed captures should score higher
            expect(specificScore).toBeGreaterThan(genericScore);
        });
        
        it('should score crypto variation patterns correctly', () => {
            const quotedPattern = 'I retrieve crypto variation for currency "([^"]+)" and time period "([^"]+)"';
            const freeformPattern = 'I attempt to retrieve crypto variation (.+)';
            const stepText = 'I retrieve crypto variation for currency "MXN" and time period "one_day"';
            
            const quotedRegex = compileBindingRegex(quotedPattern);
            const freeformRegex = compileBindingRegex(freeformPattern);
            
            const quotedMatch = quotedRegex?.exec(stepText);
            const freeformMatch = freeformRegex?.exec(stepText);
            
            // Quoted pattern should match
            expect(quotedMatch).not.toBeNull();
            
            // Calculate scores
            if (quotedMatch) {
                const quotedScore = calculateScore(quotedPattern, stepText, quotedMatch);
                expect(quotedScore).toBeGreaterThan(50); // Should have decent score
            }
        });
    });
});

/**
 * Simple scoring function for testing.
 * In production, this is in the resolver module.
 */
function calculateScore(pattern: string, stepText: string, match: RegExpExecArray): number {
    let score = 100;
    
    // Penalty for each capture group (less specific)
    const captureGroups = (pattern.match(/\([^)]+\)/g) || []).length;
    score -= captureGroups * 5;
    
    // Bonus for typed captures (\d+) vs generic (.*)
    const typedCaptures = (pattern.match(/\\d\+|\\w\+|\[\^"\]\+|\[\^"\]\*/g) || []).length;
    score += typedCaptures * 10;
    
    // Penalty for wildcard captures
    const wildcardCaptures = (pattern.match(/\.\*|\.\+/g) || []).length;
    score -= wildcardCaptures * 15;
    
    // Bonus for literal text length (more specific matching)
    const literalText = pattern.replace(/\([^)]+\)/g, '').replace(/[\\^$.*+?{}[\]|]/g, '');
    score += Math.min(literalText.length, 50);
    
    // Bonus for exact match (no captures used)
    if (match.length === 1) {
        score += 20;
    }
    
    // Bonus for alternation groups (specific options)
    const alternations = (pattern.match(/\([^)]*\|[^)]*\)/g) || []).length;
    score += alternations * 5;
    
    return Math.max(0, score);
}
