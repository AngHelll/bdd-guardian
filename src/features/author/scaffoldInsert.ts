/**
 * Pure logic for inserting generated binding scaffolds into step definition files.
 */

import { SnippetKind } from '../hovers/bindingSnippets';
import { BINDINGS_DIAGNOSTIC_SOURCE, UNBOUND_STEP_DIAGNOSTIC_CODE } from '../../core/domain/constants';

export { UNBOUND_STEP_DIAGNOSTIC_CODE };

export function isUnboundBindingDiagnostic(diagnostic: {
    source?: string;
    code?: unknown;
}): boolean {
    if (diagnostic.source !== BINDINGS_DIAGNOSTIC_SOURCE) {
        return false;
    }
    return diagnostic.code === UNBOUND_STEP_DIAGNOSTIC_CODE;
}

export function supportsScaffoldInsert(snippetKind: SnippetKind): boolean {
    return (
        snippetKind === 'csharp-reqnroll' ||
        snippetKind === 'csharp-specflow' ||
        snippetKind === 'js-cucumber'
    );
}

export function sanitizeMethodName(keyword: string, stepText: string): string {
    const slug = stepText
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return `GuardianGenerated_${keyword}_${slug || 'Step'}`;
}

/**
 * Find line index to insert a new method before the closing brace of the first [Binding] class.
 */
export function findCSharpBindingInsertLine(fileContent: string): number | null {
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes('[Binding]')) {
            continue;
        }

        let braceLine = i + 1;
        while (braceLine < lines.length && !lines[braceLine].includes('{')) {
            braceLine++;
        }
        if (braceLine >= lines.length) {
            continue;
        }

        let depth = 0;
        for (let k = braceLine; k < lines.length; k++) {
            for (const char of lines[k]) {
                if (char === '{') {
                    depth++;
                } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        return k;
                    }
                }
            }
        }
    }

    return null;
}

export function getIndentForLine(fileContent: string, lineIndex: number): string {
    const line = fileContent.split('\n')[lineIndex] ?? '';
    const match = line.match(/^(\s*)/);
    return match?.[1] ?? '        ';
}

export function formatSnippetForInsert(snippetCode: string, baseIndent: string): string {
    const inner = baseIndent + '    ';
    const body = snippetCode
        .split('\n')
        .map((l) => inner + l)
        .join('\n');
    return `\n${body}\n`;
}

export function buildCSharpNewFileContent(
    snippetCode: string,
    snippetKind: 'csharp-reqnroll' | 'csharp-specflow'
): string {
    const usingLine =
        snippetKind === 'csharp-specflow' ? 'using TechTalk.SpecFlow;' : 'using Reqnroll;';
    const indented = snippetCode
        .split('\n')
        .map((l) => `        ${l}`)
        .join('\n');
    return `${usingLine}

namespace Generated.Steps
{
    [Binding]
    public class GuardianGeneratedSteps
    {
${indented}
    }
}
`;
}

export function buildJsNewFileContent(snippetCode: string): string {
    return `import { Given, When, Then } from '@cucumber/cucumber';

${snippetCode}
`;
}

export function formatJsAppend(snippetCode: string, existingContent: string): string {
    const trimmed = existingContent.trimEnd();
    const prefix = trimmed.endsWith('\n') ? '' : '\n\n';
    return `${prefix}${snippetCode}\n`;
}

/**
 * Pick best existing binding file for scaffold insert.
 */
export function pickScaffoldTargetPath(
    snippetKind: SnippetKind,
    bindingFilePaths: readonly string[]
): string | null {
    const lower = bindingFilePaths.map((p) => p.toLowerCase());

    if (snippetKind === 'js-cucumber') {
        const ts = bindingFilePaths.find((_, i) => lower[i].endsWith('.ts') || lower[i].endsWith('.js'));
        return ts ?? null;
    }

    if (snippetKind === 'csharp-reqnroll' || snippetKind === 'csharp-specflow') {
        const cs = bindingFilePaths.find((_, i) => lower[i].endsWith('.cs'));
        return cs ?? null;
    }

    return null;
}

export function defaultNewScaffoldPath(snippetKind: SnippetKind): string | null {
    if (snippetKind === 'csharp-reqnroll' || snippetKind === 'csharp-specflow') {
        return 'StepDefinitions/GuardianGeneratedSteps.cs';
    }
    if (snippetKind === 'js-cucumber') {
        return 'features/step_definitions/guardian-generated.steps.ts';
    }
    return null;
}
