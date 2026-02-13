/**
 * Normalization Utilities
 * Handles whitespace normalization and placeholder expansion for step matching
 */

import { ExampleTable } from '../domain/types';
import { MAX_CANDIDATES_PER_STEP, PLACEHOLDER_REGEX } from '../domain/constants';

/**
 * Normalize whitespace in a string: trim and collapse multiple spaces/tabs to single space.
 * Does not alter quotes or other characters.
 */
export function normalizeWhitespace(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
}

/**
 * Generate candidate texts for matching from a step text.
 * 
 * For Scenario Outline steps:
 * - Replaces <placeholders> with actual values from Examples rows
 * - Limited to MAX_CANDIDATES_PER_STEP candidates
 * - Always includes fallback candidate with <placeholder> -> "X"
 * 
 * @param rawText The raw step text (may contain <placeholders>)
 * @param examples Optional Examples tables for Scenario Outline
 * @returns Array of candidate texts for matching
 */
export function generateCandidateTexts(rawText: string, examples?: readonly ExampleTable[]): string[] {
    const candidates: string[] = [];
    const normalizedText = normalizeWhitespace(rawText);

    // Check if text contains placeholders
    const hasPlaceholders = PLACEHOLDER_REGEX.test(normalizedText);
    // Reset regex state after test
    PLACEHOLDER_REGEX.lastIndex = 0;

    // Default candidate: replace <placeholder> with "X" (fallback)
    const defaultCandidate = normalizedText.replace(PLACEHOLDER_REGEX, 'X');
    candidates.push(defaultCandidate);

    // If no placeholders or no examples, return just the default
    if (!hasPlaceholders || !examples || examples.length === 0) {
        return candidates;
    }

    // Expand placeholders with actual values from Examples
    for (const example of examples) {
        if (example.headers.length === 0) continue;

        // Calculate how many rows we can process
        const remainingSlots = MAX_CANDIDATES_PER_STEP - candidates.length;
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

            // Normalize the expanded text
            expandedText = normalizeWhitespace(expandedText);

            // Add if unique
            if (!candidates.includes(expandedText)) {
                candidates.push(expandedText);
            }
        }
    }

    return candidates;
}

/**
 * Extract placeholders from a step text
 * @returns Array of placeholder names (without < >)
 */
export function extractPlaceholders(text: string): string[] {
    const placeholders: string[] = [];
    let match;
    
    // Create new regex instance to avoid state issues
    const regex = new RegExp(PLACEHOLDER_REGEX.source, 'g');
    
    while ((match = regex.exec(text)) !== null) {
        placeholders.push(match[1]);
    }
    
    return placeholders;
}

/**
 * Normalize step text for matching.
 * Combines whitespace normalization with other text transformations.
 * 
 * @param text Raw step text
 * @returns Normalized text suitable for binding matching
 */
export function normalizeStepText(text: string): string {
    return normalizeWhitespace(text);
}
