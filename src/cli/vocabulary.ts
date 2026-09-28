/**
 * vocabulary — humanized binding catalog (advisory, not a match report).
 */

import type { ResolvedKeyword } from '../core/domain/types';
import { toVocabulary, type VocabularyRow } from '../core/reuse/vocabulary';
import type { LoadedProject } from './loadProject';
import { toPosixRelative } from './loadProject';
import { CLI_SCHEMA_VERSION } from './discover';
import { parseReuseKeyword } from './suggestReuse';

export interface VocabularyReport {
    schemaVersion: number;
    count: number;
    steps: VocabularyRow[];
}

export function buildVocabularyReport(
    project: LoadedProject,
    options: { maxItems: number; keyword?: ResolvedKeyword }
): VocabularyReport {
    const rows = toVocabulary(
        project.bindings.map(({ binding }) => ({
            patternRaw: binding.patternRaw,
            methodName: binding.methodName,
            keyword: binding.keyword,
            filePath: toPosixRelative(project.projectDir, binding.uri.fsPath),
            line: binding.lineNumber,
        }))
    ).filter((row) => options.keyword === undefined || row.keyword === options.keyword);

    return {
        schemaVersion: CLI_SCHEMA_VERSION,
        count: rows.length,
        steps: rows.slice(0, options.maxItems),
    };
}

export { parseReuseKeyword };
