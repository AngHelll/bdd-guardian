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
        snippetKind === 'js-cucumber' ||
        snippetKind === 'python-behave' ||
        snippetKind === 'go-godog' ||
        snippetKind === 'java-cucumber'
    );
}

/** Stacks that append snippet at end of an existing file. */
export function usesAppendInsert(snippetKind: SnippetKind): boolean {
    return snippetKind === 'js-cucumber' || snippetKind === 'python-behave';
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
    return findClosingBraceLineAfterMarker(fileContent, (line) => line.includes('[Binding]'));
}

/**
 * Insert before closing brace of first class that looks like Cucumber step defs.
 */
export function findJavaStepClassInsertLine(fileContent: string): number | null {
    const hasStepAnnotation = /@(Given|When|Then|And|But)\b/.test(fileContent);
    if (hasStepAnnotation) {
        return findClosingBraceLineAfterMarker(fileContent, (line) =>
            /\b(public|protected|private)?\s*(final\s+)?class\b/.test(line)
        );
    }
    return findClosingBraceLineAfterMarker(fileContent, (line) =>
        /\b(public|protected|private)?\s*(final\s+)?class\b/.test(line)
    );
}

/**
 * Insert before closing brace of `InitializeScenario` (Godog registration site).
 */
export function findGoInitializeScenarioInsertLine(fileContent: string): number | null {
    return findClosingBraceLineAfterMarker(fileContent, (line) =>
        /func\s+InitializeScenario\s*\(/.test(line)
    );
}

function findClosingBraceLineAfterMarker(
    fileContent: string,
    isMarker: (line: string) => boolean
): number | null {
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (!isMarker(lines[i])) {
            continue;
        }

        let braceLine = i;
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

/** Strip leading guidance comment from Godog hover/generate snippets. */
export function stripGoScaffoldComment(snippetCode: string): string {
    return snippetCode
        .split('\n')
        .filter((line) => !line.trim().startsWith('// In InitializeScenario'))
        .join('\n')
        .trim();
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

export function buildPythonNewFileContent(snippetCode: string): string {
    return `from behave import given, when, then


${snippetCode}
`;
}

export function buildGoNewFileContent(snippetCode: string): string {
    const body = stripGoScaffoldComment(snippetCode)
        .split('\n')
        .map((l) => `\t${l}`)
        .join('\n');
    return `package features

import (
	"context"

	"github.com/cucumber/godog"
)

func InitializeScenario(ctx *godog.ScenarioContext) {
${body}
}
`;
}

export function buildJavaNewFileContent(snippetCode: string): string {
    const indented = snippetCode
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n');
    return `package generated;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import io.cucumber.java.en.Then;

public class GuardianGeneratedSteps {
${indented}
}
`;
}

export function formatJsAppend(snippetCode: string, existingContent: string): string {
    const trimmed = existingContent.trimEnd();
    const prefix = trimmed.endsWith('\n') ? '' : '\n\n';
    return `${prefix}${snippetCode}\n`;
}

export const formatSnippetAppend = formatJsAppend;

function pickByExtension(
    bindingFilePaths: readonly string[],
    extensions: readonly string[],
    preferSubstrings: readonly string[] = []
): string | null {
    const lower = bindingFilePaths.map((p) => p.toLowerCase());
    const matches = bindingFilePaths.filter((_, i) =>
        extensions.some((ext) => lower[i].endsWith(ext))
    );
    if (matches.length === 0) {
        return null;
    }
    if (preferSubstrings.length > 0) {
        const preferred = matches.find((p) => {
            const lp = p.toLowerCase();
            return preferSubstrings.some((s) => lp.includes(s));
        });
        if (preferred) {
            return preferred;
        }
    }
    return matches[0];
}

/**
 * Pick best existing binding file for scaffold insert.
 */
export function pickScaffoldTargetPath(
    snippetKind: SnippetKind,
    bindingFilePaths: readonly string[]
): string | null {
    if (snippetKind === 'js-cucumber') {
        return pickByExtension(bindingFilePaths, ['.ts', '.js'], ['step_definitions', 'steps']);
    }

    if (snippetKind === 'csharp-reqnroll' || snippetKind === 'csharp-specflow') {
        return pickByExtension(bindingFilePaths, ['.cs']);
    }

    if (snippetKind === 'python-behave') {
        return pickByExtension(bindingFilePaths, ['.py'], ['features/steps', '/steps/', 'step']);
    }

    if (snippetKind === 'go-godog') {
        return pickByExtension(bindingFilePaths, ['.go'], ['_test.go', 'steps']);
    }

    if (snippetKind === 'java-cucumber') {
        return pickByExtension(bindingFilePaths, ['.java'], ['steps', 'stepdefinitions']);
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
    if (snippetKind === 'python-behave') {
        return 'features/steps/guardian_generated_steps.py';
    }
    if (snippetKind === 'go-godog') {
        return 'features/guardian_generated_steps_test.go';
    }
    if (snippetKind === 'java-cucumber') {
        return 'src/test/java/generated/GuardianGeneratedSteps.java';
    }
    return null;
}

export function buildNewScaffoldFileContent(
    snippetKind: SnippetKind,
    snippetCode: string
): string | null {
    switch (snippetKind) {
        case 'js-cucumber':
            return buildJsNewFileContent(snippetCode);
        case 'python-behave':
            return buildPythonNewFileContent(snippetCode);
        case 'go-godog':
            return buildGoNewFileContent(snippetCode);
        case 'java-cucumber':
            return buildJavaNewFileContent(snippetCode);
        case 'csharp-specflow':
            return buildCSharpNewFileContent(snippetCode, 'csharp-specflow');
        case 'csharp-reqnroll':
        case 'generic-csharp-fallback':
            return buildCSharpNewFileContent(snippetCode, 'csharp-reqnroll');
        default:
            return null;
    }
}
