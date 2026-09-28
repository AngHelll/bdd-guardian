/**
 * suggest-reuse — advisory nearest binding for a proposed step (not a match status).
 */

import type { ResolvedKeyword } from '../core/domain/types';
import { isBindingInScope } from '../core/matching/scopeFilter';
import { suggestReuse, type ReuseBindingSource } from '../core/reuse/suggestReuse';
import type { LoadedProject } from './loadProject';
import { toPosixRelative } from './loadProject';
import { CLI_SCHEMA_VERSION } from './discover';

export interface SuggestReuseSuggestionRow {
    path: string;
    line: number;
    pattern: string;
    methodName: string;
    humanized: string;
    score: number;
}

export interface SuggestReuseReport {
    schemaVersion: number;
    status: 'reuse' | 'none';
    stepText: string;
    keyword: ResolvedKeyword;
    suggestion: SuggestReuseSuggestionRow | null;
}

export function parseReuseKeyword(value: string): ResolvedKeyword | undefined {
    if (value === 'Given' || value === 'When' || value === 'Then') {
        return value;
    }
    return undefined;
}

export function buildSuggestReuseReport(
    project: LoadedProject,
    stepText: string,
    keyword: ResolvedKeyword,
    tags?: readonly string[]
): SuggestReuseReport {
    const sources: ReuseBindingSource[] = [];
    for (const { binding } of project.bindings) {
        if (tags !== undefined && !isBindingInScope(binding, tags)) {
            continue;
        }
        sources.push({
            patternRaw: binding.patternRaw,
            methodName: binding.methodName,
            keyword: binding.keyword,
            filePath: toPosixRelative(project.projectDir, binding.uri.fsPath),
            line: binding.lineNumber,
        });
    }

    const result = suggestReuse(stepText, keyword, sources);
    if (result.kind === 'none') {
        return {
            schemaVersion: CLI_SCHEMA_VERSION,
            status: 'none',
            stepText,
            keyword,
            suggestion: null,
        };
    }

    return {
        schemaVersion: CLI_SCHEMA_VERSION,
        status: 'reuse',
        stepText,
        keyword,
        suggestion: {
            path: result.filePath,
            line: result.line,
            pattern: result.patternRaw,
            methodName: result.methodName,
            humanized: result.humanized,
            score: result.score,
        },
    };
}
