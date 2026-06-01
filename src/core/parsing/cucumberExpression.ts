/**
 * Cucumber Expressions → RegExp compiler (MVP)
 *
 * This is intentionally small: it supports high-ROI placeholders used in
 * Reqnroll/Cucumber projects ({int}, {float}, {word}, {string}) and treats all
 * other characters as literals (escaped).
 *
 * Out of scope (Wave B/C): optional text, alternations in CE, custom parameter types.
 */

export type CucumberExpressionParameterType =
    | 'int'
    | 'float'
    | 'double'
    | 'word'
    | 'string';

const PLACEHOLDER_REGEX = /\{([a-zA-Z][\w-]*)\}/g;

function escapeRegexLiteral(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parameterTypeToRegex(name: string): string | null {
    const lower = name.toLowerCase();
    switch (lower as CucumberExpressionParameterType) {
        case 'int':
            // Cucumber int allows negative numbers.
            return '(-?\\d+)';
        case 'float':
        case 'double':
            // MVP numeric: int or decimal, optional leading minus.
            return '(-?\\d+(?:\\.\\d+)?)';
        case 'word':
            // MVP: "word" without whitespace.
            return '(\\S+)';
        case 'string':
            // MVP: quoted string (single or double quotes).
            // Captures the inner string; two capture groups are acceptable for matching purposes.
            return '(?:"([^"]*)"|\'([^\']*)\')';
        default:
            return null;
    }
}

export function looksLikeCucumberExpression(patternRaw: string): boolean {
    // Important: do NOT treat regex quantifiers like \d{2} as CE.
    return PLACEHOLDER_REGEX.test(patternRaw);
}

/**
 * Compile a Cucumber Expression to a strict full-line regex.
 */
export function compileCucumberExpressionToRegex(
    expressionRaw: string,
    caseInsensitive: boolean = false
): RegExp | null {
    const parts: string[] = [];
    let lastIndex = 0;

    PLACEHOLDER_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PLACEHOLDER_REGEX.exec(expressionRaw)) !== null) {
        const before = expressionRaw.slice(lastIndex, match.index);
        parts.push(escapeRegexLiteral(before));

        const placeholderName = match[1];
        const paramRegex = parameterTypeToRegex(placeholderName);
        if (!paramRegex) {
            return null;
        }
        parts.push(paramRegex);

        lastIndex = match.index + match[0].length;
    }

    const after = expressionRaw.slice(lastIndex);
    parts.push(escapeRegexLiteral(after));

    const flags = (caseInsensitive ? 'i' : '') + 'u';
    return new RegExp('^' + parts.join('') + '$', flags);
}

