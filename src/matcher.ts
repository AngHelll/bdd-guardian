/**
 * Step Matcher Engine
 * Matches feature steps to C# bindings with scoring
 * 
 * Features:
 * - Scenario Outline + Examples expansion (up to 20 candidates)
 * - Whitespace normalization for consistent matching
 * - Debug logging for troubleshooting
 */

import {
    FeatureStep,
    StepBinding,
    MatchResult,
    StepMatchResult,
    ResolvedKeyword,
    getConfig,
    normalizeWhitespace,
} from './types';
import { BindingIndexer } from './indexers/bindingIndexer';

// Scoring constants
const SCORE_KEYWORD_MATCH = 120;
const SCORE_ANCHORED_PATTERN = 30;
const SCORE_SPECIFIC_GROUP = 20;
const PENALTY_WILDCARD = 15;
const PENALTY_KEYWORD_FALLBACK = 40;

// Maximum candidate strings per step (for performance)
const MAX_CANDIDATES = 20;

// Regex patterns for scoring
const WILDCARD_PATTERN = /\(\.\*\)|\(\.\+\)|\.\*|\.\+/g;
const SPECIFIC_GROUP_PATTERN = /\\d\+|\[\^"\]\+|\\w\+|\[\^\\s\]\+/g;

export class StepMatcher {
    constructor(private bindingIndexer: BindingIndexer) {}

    /**
     * Match a feature step to bindings
     */
    public matchStep(step: FeatureStep): StepMatchResult {
        const config = getConfig();
        const candidateStrings = this.buildCandidateStrings(step);
        const matches: MatchResult[] = [];

        // Debug logging
        if (config.debug) {
            console.log(`[Reqnroll Debug] Step: "${step.stepText}"`);
            console.log(`[Reqnroll Debug]   Candidates: ${candidateStrings.length}`);
            if (candidateStrings.length > 0) {
                console.log(`[Reqnroll Debug]   First: "${candidateStrings[0]}"`);
            }
            if (candidateStrings.length > 1) {
                console.log(`[Reqnroll Debug]   Second: "${candidateStrings[1]}"`);
            }
        }

        // First, try matching with exact keyword
        const keywordBindings = this.bindingIndexer.getBindingsByKeyword(step.keywordResolved);
        
        for (const binding of keywordBindings) {
            const matchResult = this.tryMatch(binding, candidateStrings, true);
            if (matchResult) {
                matches.push(matchResult);
            }
        }

        // If no matches, try fallback to other keywords
        if (matches.length === 0) {
            const allBindings = this.bindingIndexer.getAllBindings();
            for (const binding of allBindings) {
                if (binding.keyword !== step.keywordResolved) {
                    const matchResult = this.tryMatch(binding, candidateStrings, false);
                    if (matchResult) {
                        matches.push(matchResult);
                    }
                }
            }
        }

        // Sort by score descending
        matches.sort((a, b) => b.score - a.score);

        // Determine status
        let status: 'bound' | 'unbound' | 'ambiguous';
        let bestMatch: MatchResult | undefined;

        if (matches.length === 0) {
            status = 'unbound';
        } else if (matches.length === 1) {
            status = 'bound';
            bestMatch = matches[0];
        } else {
            // Check if top matches have same score (ambiguous)
            if (matches[0].score === matches[1].score) {
                status = 'ambiguous';
            } else {
                status = 'bound';
            }
            bestMatch = matches[0];
        }

        // Debug logging for result
        if (config.debug) {
            if (bestMatch) {
                console.log(`[Reqnroll Debug]   -> Matched: ${bestMatch.binding.methodSignature} (score: ${bestMatch.score})`);
            } else {
                console.log(`[Reqnroll Debug]   -> No match found`);
            }
        }

        return {
            step,
            status,
            matches,
            bestMatch,
        };
    }

    /**
     * Build candidate strings for matching
     * 
     * For Scenario Outline with Examples:
     * - Generate candidates by replacing <placeholders> with actual values from Examples rows
     * - Limit to MAX_CANDIDATES (20) for performance
     * - Always include fallback candidate with <placeholder> -> "X"
     */
    private buildCandidateStrings(step: FeatureStep): string[] {
        const candidates: string[] = [];
        const normalizedText = normalizeWhitespace(step.stepText);

        // Default candidate: replace <placeholder> with "X" (fallback)
        const defaultCandidate = normalizedText.replace(/<[^>]+>/g, 'X');
        candidates.push(defaultCandidate);

        // If Scenario Outline with Examples, expand placeholders
        if (step.examples && step.examples.length > 0) {
            for (const example of step.examples) {
                if (example.headers.length === 0) continue;

                // Calculate how many rows we can process
                const remainingSlots = MAX_CANDIDATES - candidates.length;
                if (remainingSlots <= 0) break;

                const maxRows = Math.min(example.rows.length, remainingSlots);

                for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
                    const row = example.rows[rowIdx];
                    let expandedText = normalizedText;

                    // Replace each placeholder with the corresponding value
                    for (let colIdx = 0; colIdx < example.headers.length; colIdx++) {
                        const placeholder = `<${example.headers[colIdx]}>`;
                        const value = row[colIdx] ?? 'X';
                        // Replace all occurrences of this placeholder
                        expandedText = expandedText.split(placeholder).join(value);
                    }

                    // Apply whitespace normalization to expanded text
                    expandedText = normalizeWhitespace(expandedText);

                    // Add if unique and not same as default
                    if (!candidates.includes(expandedText)) {
                        candidates.push(expandedText);
                    }
                }
            }
        }

        return candidates;
    }

    /**
     * Try to match a binding against candidate strings
     * Returns match result if ANY candidate matches the binding regex
     */
    private tryMatch(binding: StepBinding, candidates: string[], keywordMatched: boolean): MatchResult | null {
        let matchedCandidate: string | undefined;

        // Test regex against each candidate
        for (const candidate of candidates) {
            // Reset regex state for multiple tests
            binding.regex.lastIndex = 0;
            if (binding.regex.test(candidate)) {
                matchedCandidate = candidate;
                break;
            }
        }

        if (!matchedCandidate) {
            return null;
        }

        const score = this.calculateScore(binding, keywordMatched);

        return {
            binding,
            score,
            keywordMatched,
            matchedCandidate,
        };
    }

    /**
     * Calculate match score for a binding
     */
    private calculateScore(binding: StepBinding, keywordMatched: boolean): number {
        let score = 0;

        // Keyword match bonus
        if (keywordMatched) {
            score += SCORE_KEYWORD_MATCH;
        } else {
            score -= PENALTY_KEYWORD_FALLBACK;
        }

        // Normalize pattern for scoring (don't affect regex semantics)
        const normalizedPattern = normalizeWhitespace(binding.patternRaw);

        // Literal character count
        const literalChars = this.countLiteralCharacters(normalizedPattern);
        score += literalChars;

        // Wildcard penalty
        const wildcardCount = (normalizedPattern.match(WILDCARD_PATTERN) || []).length;
        score -= wildcardCount * PENALTY_WILDCARD;

        // Specific group bonus
        const specificGroupCount = (normalizedPattern.match(SPECIFIC_GROUP_PATTERN) || []).length;
        score += specificGroupCount * SCORE_SPECIFIC_GROUP;

        // Anchored pattern bonus
        if (binding.patternRaw.startsWith('^') && binding.patternRaw.endsWith('$')) {
            score += SCORE_ANCHORED_PATTERN;
        }

        return score;
    }

    /**
     * Count literal (non-regex) characters in pattern
     */
    private countLiteralCharacters(pattern: string): number {
        // Remove regex special constructs
        const literal = pattern
            .replace(/\^\$?/g, '')  // Remove anchors
            .replace(/\(\.\*\)|\(\.\+\)/g, '')  // Remove wildcards
            .replace(/\.\*|\.\+|\.\?/g, '')  // Remove unanchored wildcards
            .replace(/\\d\+|\\w\+|\\s\+/g, '')  // Remove character classes
            .replace(/\[\^[^\]]+\]\+?/g, '')  // Remove negated character classes
            .replace(/\([^)]+\)/g, '')  // Remove groups
            .replace(/\\/g, '');  // Remove escape characters

        return literal.length;
    }

    /**
     * Escape string for use in regex
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Match all steps in a feature file
     */
    public matchAllSteps(steps: FeatureStep[]): StepMatchResult[] {
        return steps.map(step => this.matchStep(step));
    }

    /**
     * Filter steps by tag configuration
     */
    public filterStepsByTags(steps: FeatureStep[]): FeatureStep[] {
        const config = getConfig();
        
        if (config.tagFilter.length === 0) {
            return steps;
        }

        return steps.filter(step => {
            const hasMatchingTag = step.tagsInScope.some(tag => 
                config.tagFilter.some(filterTag => 
                    tag.toLowerCase() === filterTag.toLowerCase()
                )
            );

            if (config.tagFilterMode === 'include') {
                return hasMatchingTag;
            } else {
                return !hasMatchingTag;
            }
        });
    }
}
