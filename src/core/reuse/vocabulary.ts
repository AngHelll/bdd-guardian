/**
 * Humanized step vocabulary for people and agents. Not a matcher.
 */

import { humanizePatternForCompletion } from '../autocomplete/stepCompletion';
import type { ResolvedKeyword } from '../domain/types';
import { patternTokenSequence, type ReuseBindingSource } from './suggestReuse';

export interface VocabularyRow {
    readonly keyword: ResolvedKeyword;
    readonly humanized: string;
    readonly pattern: string;
    readonly methodName: string;
    readonly path: string;
    readonly line: number;
    readonly parameterized: boolean;
}

export function isParameterizedPattern(patternRaw: string): boolean {
    return patternTokenSequence(patternRaw).includes('param');
}

export function toVocabulary(bindings: readonly ReuseBindingSource[]): VocabularyRow[] {
    return bindings
        .map((binding) => ({
            keyword: binding.keyword,
            humanized: humanizePatternForCompletion(binding.patternRaw, binding.methodName),
            pattern: binding.patternRaw,
            methodName: binding.methodName,
            path: binding.filePath,
            line: binding.line,
            parameterized: isParameterizedPattern(binding.patternRaw),
        }))
        .sort((a, b) => a.keyword.localeCompare(b.keyword) || a.humanized.localeCompare(b.humanized) || a.path.localeCompare(b.path));
}
