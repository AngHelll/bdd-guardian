/**
 * Expand provider binding globs for vscode.workspace.findFiles.
 * VS Code often fails on top-level brace alternation with nested `{ext}` groups.
 */

/**
 * Split `{a,b,c}` at top-level commas (respects nested `{...}`).
 */
export function splitTopLevelGlobAlternatives(pattern: string): string[] {
    const trimmed = pattern.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return [trimmed];
    }

    const inner = trimmed.slice(1, -1);
    const parts: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
        } else if (c === ',' && depth === 0) {
            const segment = inner.slice(start, i).trim();
            if (segment) {
                parts.push(segment);
            }
            start = i + 1;
        }
    }

    const last = inner.slice(start).trim();
    if (last) {
        parts.push(last);
    }

    return parts.length > 0 ? parts : [trimmed];
}

/**
 * Globs to pass to findFiles for a provider (one or more alternatives).
 */
export function resolveBindingSearchGlobs(bindingGlob: string): string[] {
    return splitTopLevelGlobAlternatives(bindingGlob);
}
