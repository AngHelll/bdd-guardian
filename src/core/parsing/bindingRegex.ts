/**
 * Binding Regex Compiler
 * Framework-agnostic: compiles a pattern string (from any provider) to JavaScript RegExp.
 * Keeps full-step matching (^...$) so step definitions remain strict; no relaxation of BDD practices.
 */

/** Regex special characters to escape when using pattern as literal fallback */
const LITERAL_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

/**
 * Escape literal $ and ^ in the middle of the pattern so they match as characters.
 * - $ not at end and not already escaped (\) → literal dollar (e.g. "Cost is $5").
 * - ^ not at start and not already escaped and not inside [ ] (negation) → literal caret.
 * Anchors at the very start (^) or end ($) are preserved for full-step matching.
 */
function escapeLiteralAnchors(pattern: string): string {
    // $ not at end and not preceded by backslash → literal dollar
    let out = pattern.replace(/(?<!\\)\$(?!$)/g, '\\$');
    // ^ not at start, and not after \ or [ (so we keep [^"] and ^ at start)
    out = out.replace(/\^/g, (m, offset, str) => {
        if (offset === 0) return m;
        const prev = str[offset - 1];
        if (prev === '\\' || prev === '[') return m;
        return '\\^';
    });
    return out;
}

/**
 * Build a regex that matches the exact string (no regex metacharacters). Used as fallback on compile error.
 */
function compileLiteralPattern(patternRaw: string, caseInsensitive: boolean): RegExp {
    const escaped = patternRaw.replace(LITERAL_ESCAPE_REGEX, '\\$&');
    const flags = (caseInsensitive ? 'i' : '') + 'u';
    return new RegExp('^' + escaped + '$', flags);
}

/**
 * Compile a binding pattern string into a JavaScript RegExp.
 * Framework-agnostic: the pattern string is produced by each provider (C#, JS, etc.).
 *
 * - Ensures full-step match (^...$) so step definitions stay strict.
 * - Escapes $ and ^ when they are literal (e.g. "Cost is $5").
 * - Uses Unicode flag (u) for correct behavior with non-ASCII step text.
 * - On invalid pattern: tries fallback to exact literal match so the binding is not dropped.
 *
 * @param patternRaw The raw pattern string (already unescaped by the caller)
 * @param caseInsensitive Whether to compile with case insensitivity
 * @returns Compiled RegExp or null if invalid and literal fallback also fails
 */
export function compileBindingRegex(patternRaw: string, caseInsensitive: boolean = false): RegExp | null {
    try {
        let pattern = escapeLiteralAnchors(patternRaw);

        if (!pattern.startsWith('^')) {
            pattern = '^' + pattern;
        }
        if (!pattern.endsWith('$')) {
            pattern = pattern + '$';
        }

        const flags = (caseInsensitive ? 'i' : '') + 'u';
        return new RegExp(pattern, flags);
    } catch (error) {
        console.warn(`[BDD Guardian] Invalid regex pattern: ${patternRaw}`, error);
        try {
            return compileLiteralPattern(patternRaw, caseInsensitive);
        } catch (fallbackError) {
            return null;
        }
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
