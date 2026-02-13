/**
 * Scoring Model
 * Calculates match scores for step-to-binding matches
 * 
 * Scoring factors:
 * - Keyword match: +120 (or -40 penalty for fallback)
 * - Literal characters: +1 per character
 * - Wildcards: -15 per wildcard
 * - Specific groups: +20 per specific capture group
 * - Anchored pattern: +30
 */

import { Binding } from '../domain/types';
import {
    SCORE_KEYWORD_MATCH,
    SCORE_ANCHORED_PATTERN,
    SCORE_SPECIFIC_GROUP,
    PENALTY_WILDCARD,
    PENALTY_KEYWORD_FALLBACK,
    WILDCARD_PATTERN,
    SPECIFIC_GROUP_PATTERN,
} from '../domain/constants';
import { normalizeWhitespace } from './normalization';

/**
 * Calculate match score for a binding
 * 
 * @param binding The binding to score
 * @param keywordMatched Whether the step keyword matches the binding keyword
 * @returns Numeric score (higher is better)
 */
export function calculateScore(binding: Binding, keywordMatched: boolean): number {
    let score = 0;

    // Keyword match bonus/penalty
    if (keywordMatched) {
        score += SCORE_KEYWORD_MATCH;
    } else {
        score -= PENALTY_KEYWORD_FALLBACK;
    }

    // Normalize pattern for scoring
    const normalizedPattern = normalizeWhitespace(binding.patternRaw);

    // Literal character count
    const literalChars = countLiteralCharacters(normalizedPattern);
    score += literalChars;

    // Wildcard penalty
    const wildcardCount = countMatches(normalizedPattern, WILDCARD_PATTERN);
    score -= wildcardCount * PENALTY_WILDCARD;

    // Specific group bonus
    const specificGroupCount = countMatches(normalizedPattern, SPECIFIC_GROUP_PATTERN);
    score += specificGroupCount * SCORE_SPECIFIC_GROUP;

    // Anchored pattern bonus
    if (binding.patternRaw.startsWith('^') && binding.patternRaw.endsWith('$')) {
        score += SCORE_ANCHORED_PATTERN;
    }

    return score;
}

/**
 * Count literal (non-regex special) characters in a pattern
 */
function countLiteralCharacters(pattern: string): number {
    // Remove regex special constructs
    const literal = pattern
        .replace(/\^\$?/g, '')           // Remove anchors
        .replace(/\(\.\*\)|\(\.\+\)/g, '')  // Remove wildcards in groups
        .replace(/\.\*|\.\+|\.\?/g, '')     // Remove unanchored wildcards
        .replace(/\\d\+|\\w\+|\\s\+/g, '')  // Remove character classes
        .replace(/\[\^[^\]]+\]\+?/g, '')    // Remove negated character classes
        .replace(/\([^)]+\)/g, '')          // Remove groups
        .replace(/\\/g, '');                // Remove escape characters

    return literal.length;
}

/**
 * Count regex pattern matches in a string
 */
function countMatches(text: string, pattern: RegExp): number {
    const matches = text.match(new RegExp(pattern.source, 'g'));
    return matches ? matches.length : 0;
}

/**
 * Compare two scores for sorting (descending)
 */
export function compareScores(a: number, b: number): number {
    return b - a;
}
