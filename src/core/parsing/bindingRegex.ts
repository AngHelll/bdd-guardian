/**
 * Binding Regex Compiler
 * Safely compiles C# binding patterns to JavaScript RegExp
 */

/**
 * Compile a C# binding pattern into a JavaScript regex
 * Handles anchors and case sensitivity
 * 
 * @param patternRaw The raw pattern string (already unescaped)
 * @param caseInsensitive Whether to compile with case insensitivity
 * @returns Compiled RegExp or null if invalid
 */
export function compileBindingRegex(patternRaw: string, caseInsensitive: boolean = false): RegExp | null {
    try {
        let pattern = patternRaw;
        
        // If pattern doesn't have ^ at start, add it (ensure full match)
        if (!pattern.startsWith('^')) {
            pattern = '^' + pattern;
        }
        
        // If pattern doesn't have $ at end, add it
        if (!pattern.endsWith('$')) {
            pattern = pattern + '$';
        }
        
        // Create regex with optional case insensitivity
        const flags = caseInsensitive ? 'i' : '';
        return new RegExp(pattern, flags);
    } catch (error) {
        console.warn(`[Reqnroll Navigator] Invalid regex pattern: ${patternRaw}`, error);
        return null;
    }
}

/**
 * Test if a pattern is anchored (starts with ^ and ends with $)
 */
export function isPatternAnchored(pattern: string): boolean {
    return pattern.startsWith('^') && pattern.endsWith('$');
}

/**
 * Count the number of capture groups in a pattern
 */
export function countCaptureGroups(pattern: string): number {
    // Count ( that are not escaped and not followed by ?
    let count = 0;
    let i = 0;
    while (i < pattern.length) {
        if (pattern[i] === '\\') {
            // Skip escaped character
            i += 2;
            continue;
        }
        if (pattern[i] === '(' && pattern[i + 1] !== '?') {
            count++;
        }
        i++;
    }
    return count;
}
