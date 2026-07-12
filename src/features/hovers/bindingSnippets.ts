/**
 * Framework-aware binding snippets for hover (unbound suggestions + preview fences).
 */

import { ResolvedKeyword } from '../../core/domain';
import {
    BindingProviderId,
    PROVIDER_INFO,
    ProviderSelection,
} from '../../providers/bindings/types';

export type SnippetKind =
    | 'csharp-reqnroll'
    | 'csharp-specflow'
    | 'js-cucumber'
    | 'java-cucumber'
    | 'python-behave'
    | 'go-godog'
    | 'generic-csharp-fallback';

export interface HoverFrameworkContext {
    readonly providerId: BindingProviderId | null;
    readonly displayName: string;
    readonly snippetKind: SnippetKind;
}

export interface ResolveHoverFrameworkInput {
    readonly selection: ProviderSelection | null;
    /** Binding file path when resolving from a bound/ambiguous candidate */
    readonly bindingUriPath?: string;
}

export interface UnboundSnippet {
    readonly fenceLanguage: string;
    readonly code: string;
}

const SNIPPET_KIND_DISPLAY: Record<SnippetKind, string> = {
    'csharp-reqnroll': PROVIDER_INFO['csharp-reqnroll'].displayName,
    'csharp-specflow': PROVIDER_INFO['csharp-specflow'].displayName,
    'js-cucumber': PROVIDER_INFO['js-cucumber'].displayName,
    'java-cucumber': PROVIDER_INFO['java-cucumber'].displayName,
    'python-behave': PROVIDER_INFO['python-behave'].displayName,
    'go-godog': PROVIDER_INFO['go-godog'].displayName,
    'generic-csharp-fallback': 'C# (Reqnroll-style)',
};

function providerIdToSnippetKind(id: BindingProviderId): SnippetKind {
    if (id === 'csharp-specflow') {
        return 'csharp-specflow';
    }
    if (id === 'csharp-reqnroll') {
        return 'csharp-reqnroll';
    }
    if (id === 'js-cucumber') {
        return 'js-cucumber';
    }
    if (id === 'java-cucumber') {
        return 'java-cucumber';
    }
    if (id === 'python-behave' || id === 'python-pytestbdd') {
        return 'python-behave';
    }
    if (id === 'go-godog') {
        return 'go-godog';
    }
    return 'generic-csharp-fallback';
}

function inferSnippetKindFromUri(
    uriPath: string,
    selection: ProviderSelection | null
): SnippetKind | null {
    const lower = uriPath.toLowerCase();
    if (lower.endsWith('.ts') || lower.endsWith('.js')) {
        return 'js-cucumber';
    }
    if (lower.endsWith('.java')) {
        return 'java-cucumber';
    }
    if (lower.endsWith('.py')) {
        return 'python-behave';
    }
    if (lower.endsWith('.go')) {
        return 'go-godog';
    }
    if (lower.endsWith('.cs')) {
        if (selection?.primary?.id === 'csharp-specflow') {
            return 'csharp-specflow';
        }
        return 'csharp-reqnroll';
    }
    return null;
}

function highestConfidenceProviderId(selection: ProviderSelection): BindingProviderId | null {
    const sorted = [...selection.report].sort((a, b) => b.confidence - a.confidence);
    const top = sorted.find((r) => r.confidence > 0);
    return top?.id ?? null;
}

/**
 * Resolve which framework context to use for hover snippets.
 */
export function resolveHoverFrameworkContext(
    input: ResolveHoverFrameworkInput
): HoverFrameworkContext {
    const { selection, bindingUriPath } = input;

    if (bindingUriPath) {
        const fromUri = inferSnippetKindFromUri(bindingUriPath, selection);
        if (fromUri) {
            return {
                providerId: selection?.primary?.id ?? null,
                displayName: SNIPPET_KIND_DISPLAY[fromUri],
                snippetKind: fromUri,
            };
        }
    }

    if (selection?.primary) {
        const kind = providerIdToSnippetKind(selection.primary.id);
        return {
            providerId: selection.primary.id,
            displayName: selection.primary.displayName,
            snippetKind: kind,
        };
    }

    if (selection) {
        const id = highestConfidenceProviderId(selection);
        if (id) {
            const kind = providerIdToSnippetKind(id);
            return {
                providerId: id,
                displayName: PROVIDER_INFO[id].displayName,
                snippetKind: kind,
            };
        }
    }

    return {
        providerId: null,
        displayName: SNIPPET_KIND_DISPLAY['generic-csharp-fallback'],
        snippetKind: 'generic-csharp-fallback',
    };
}

/**
 * Map binding file extension to markdown fence language.
 */
export function getPreviewFenceLanguage(uriPath: string): string {
    const lower = uriPath.toLowerCase();
    if (lower.endsWith('.cs')) {
        return 'csharp';
    }
    if (lower.endsWith('.ts') || lower.endsWith('.js')) {
        return 'typescript';
    }
    if (lower.endsWith('.java')) {
        return 'java';
    }
    if (lower.endsWith('.py')) {
        return 'python';
    }
    if (lower.endsWith('.go')) {
        return 'go';
    }
    return 'csharp';
}

/**
 * Suggest a binding pattern from step text (shared with hover unbound).
 */
export function suggestBindingPattern(stepText: string): string {
    return stepText
        .replace(/"([^"]+)"/g, '"(.*)"')
        .replace(/'([^']+)'/g, "'(.*)'")
        .replace(/\b\d+\b/g, '(\\d+)')
        .replace(/\./g, '\\.')
        .replace(/\?/g, '\\?');
}

function toGodogRegex(pattern: string): string {
    return pattern
        .replace(/\(\\\.\*\)/g, '(.*)')
        .replace(/\(\\d\+\)/g, '(\\d+)');
}

function behaveDecorator(keyword: ResolvedKeyword): string {
    return keyword.toLowerCase();
}

/**
 * Build unbound step definition snippet for the detected framework.
 */
export function buildUnboundBindingSnippet(
    snippetKind: SnippetKind,
    keyword: ResolvedKeyword,
    pattern: string
): UnboundSnippet {
    switch (snippetKind) {
        case 'js-cucumber':
            return {
                fenceLanguage: 'typescript',
                code: `${keyword}('${pattern}', function () {\n  // TODO\n});`,
            };
        case 'java-cucumber':
            return {
                fenceLanguage: 'java',
                code: `@${keyword}("${pattern}")\npublic void stepDefinition() {\n}`,
            };
        case 'python-behave':
            return {
                fenceLanguage: 'python',
                code: `@${behaveDecorator(keyword)}('${pattern}')\ndef step_definition(context):\n    pass`,
            };
        case 'go-godog':
            return {
                fenceLanguage: 'go',
                code: [
                    '// In InitializeScenario:',
                    `ctx.${keyword}(\`^${toGodogRegex(pattern)}$\`, func(ctx context.Context) error {`,
                    '    return nil',
                    '})',
                ].join('\n'),
            };
        case 'csharp-specflow':
        case 'csharp-reqnroll':
        case 'generic-csharp-fallback':
        default:
            return {
                fenceLanguage: 'csharp',
                code: `[${keyword}(@"${pattern}")]\npublic void Step() { }`,
            };
    }
}
