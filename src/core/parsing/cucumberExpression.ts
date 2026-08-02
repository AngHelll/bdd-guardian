/**
 * Cucumber Expressions → RegExp compiler (Wave A + Wave B)
 *
 * Wave A: {int}, {float|double}, {word}, {string} → regex; other text escaped as literals.
 * Wave B: optional text `(…)`, alternation `a/b`, built-in numeric types extras.
 *
 * Out of scope (Wave C+): custom parameter types, pluralization engine, embedding
 * `@cucumber/cucumber-expressions`.
 */

export type CucumberExpressionParameterType =
    | 'int'
    | 'float'
    | 'double'
    | 'word'
    | 'string'
    | 'long'
    | 'short'
    | 'byte'
    | 'biginteger'
    | 'bigdecimal';

const PLACEHOLDER_PATTERN = /\{([a-zA-Z][\w-]*)\}/;

type Token =
    | { kind: 'text'; text: string }
    | { kind: 'space'; text: string }
    | { kind: 'optional'; inner: string }
    | { kind: 'param'; name: string }
    | { kind: 'slash' };

function escapeRegexLiteral(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Integer-like capture (optional leading minus). */
const INT_LIKE = '(-?\\d+)';
/** Decimal-like capture (int or decimal, optional leading minus). */
const DECIMAL_LIKE = '(-?\\d+(?:\\.\\d+)?)';

function parameterTypeToRegex(name: string): string | null {
    const lower = name.toLowerCase();
    switch (lower as CucumberExpressionParameterType) {
        case 'int':
        case 'long':
        case 'short':
        case 'byte':
        case 'biginteger':
            return INT_LIKE;
        case 'float':
        case 'double':
        case 'bigdecimal':
            return DECIMAL_LIKE;
        case 'word':
            return '(\\S+)';
        case 'string':
            // Captures the inner string; two capture groups are acceptable for matching purposes.
            return '(?:"([^"]*)"|\'([^\']*)\')';
        default:
            return null;
    }
}

/**
 * True when the pattern looks like a Cucumber Expression (has `{name}` placeholders).
 * Does NOT treat regex quantifiers like `\d{2}` as CE.
 */
export function looksLikeCucumberExpression(patternRaw: string): boolean {
    return PLACEHOLDER_PATTERN.test(patternRaw);
}

function findMatchingParen(text: string, openIndex: number): number {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
        const c = text[i];
        if (c === '\\' && i + 1 < text.length) {
            i++;
            continue;
        }
        if (c === '(') {
            depth++;
        } else if (c === ')') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function tokenize(expression: string): Token[] | null {
    const tokens: Token[] = [];
    let i = 0;

    while (i < expression.length) {
        const c = expression[i];

        if (c === '\\' && i + 1 < expression.length) {
            tokens.push({ kind: 'text', text: expression[i + 1] });
            i += 2;
            continue;
        }

        if (c === '{') {
            const close = expression.indexOf('}', i + 1);
            if (close === -1) {
                return null;
            }
            const name = expression.slice(i + 1, close);
            if (!/^[a-zA-Z][\w-]*$/.test(name)) {
                return null;
            }
            tokens.push({ kind: 'param', name });
            i = close + 1;
            continue;
        }

        if (c === '(') {
            const close = findMatchingParen(expression, i);
            if (close === -1) {
                return null;
            }
            tokens.push({ kind: 'optional', inner: expression.slice(i + 1, close) });
            i = close + 1;
            continue;
        }

        if (c === '/') {
            tokens.push({ kind: 'slash' });
            i++;
            continue;
        }

        if (/\s/.test(c)) {
            let j = i + 1;
            while (j < expression.length && /\s/.test(expression[j])) {
                j++;
            }
            tokens.push({ kind: 'space', text: expression.slice(i, j) });
            i = j;
            continue;
        }

        let j = i + 1;
        while (
            j < expression.length &&
            !/\s/.test(expression[j]) &&
            expression[j] !== '{' &&
            expression[j] !== '(' &&
            expression[j] !== '/' &&
            expression[j] !== '\\'
        ) {
            j++;
        }
        tokens.push({ kind: 'text', text: expression.slice(i, j) });
        i = j;
    }

    return tokens;
}

function compileOptionalInner(inner: string): string | null {
    const tokens = tokenize(inner);
    if (!tokens) {
        return null;
    }
    // Optional text should not contain parameters (Cucumber treats that as invalid CE).
    if (tokens.some(t => t.kind === 'param')) {
        return null;
    }
    return compileTokenSequence(tokens);
}

function compileAtom(token: Token): string | null {
    switch (token.kind) {
        case 'text':
            return escapeRegexLiteral(token.text);
        case 'space':
            return escapeRegexLiteral(token.text);
        case 'optional': {
            const inner = compileOptionalInner(token.inner);
            if (inner === null) {
                return null;
            }
            return `(?:${inner})?`;
        }
        case 'param': {
            const paramRegex = parameterTypeToRegex(token.name);
            if (!paramRegex) {
                return null;
            }
            return paramRegex;
        }
        case 'slash':
            return null;
    }
}

/**
 * Compile a run of non-space tokens, honoring `/` alternation between alternatives.
 */
function compileWordGroup(group: Token[]): string | null {
    if (group.length === 0) {
        return '';
    }

    const alternatives: Token[][] = [[]];
    for (const token of group) {
        if (token.kind === 'slash') {
            alternatives.push([]);
            continue;
        }
        alternatives[alternatives.length - 1].push(token);
    }

    if (alternatives.some(alt => alt.length === 0)) {
        // Trailing/leading `/` or `//` — invalid CE for our MVP.
        return null;
    }

    const compiledAlts: string[] = [];
    for (const alt of alternatives) {
        let part = '';
        for (const token of alt) {
            const atom = compileAtom(token);
            if (atom === null) {
                return null;
            }
            part += atom;
        }
        compiledAlts.push(part);
    }

    if (compiledAlts.length === 1) {
        return compiledAlts[0];
    }
    return `(?:${compiledAlts.join('|')})`;
}

function compileTokenSequence(tokens: Token[]): string | null {
    let result = '';
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];
        if (token.kind === 'space') {
            result += escapeRegexLiteral(token.text);
            i++;
            continue;
        }

        const group: Token[] = [];
        while (i < tokens.length && tokens[i].kind !== 'space') {
            group.push(tokens[i]);
            i++;
        }

        const compiled = compileWordGroup(group);
        if (compiled === null) {
            return null;
        }
        result += compiled;
    }

    return result;
}

/**
 * Compile a Cucumber Expression to a strict full-line regex.
 * Returns null when the expression is not a supported CE (e.g. unknown `{CustomType}`).
 */
export function compileCucumberExpressionToRegex(
    expressionRaw: string,
    caseInsensitive: boolean = false
): RegExp | null {
    const tokens = tokenize(expressionRaw);
    if (!tokens) {
        return null;
    }

    const body = compileTokenSequence(tokens);
    if (body === null) {
        return null;
    }

    const flags = (caseInsensitive ? 'i' : '') + 'u';
    return new RegExp('^' + body + '$', flags);
}
