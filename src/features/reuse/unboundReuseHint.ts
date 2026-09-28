/**
 * Map in-scope bindings to a reuse hint. Call only after resolve status is unbound.
 */

import type { Binding, FeatureStep } from '../../core/domain';
import { isBindingInScope } from '../../core/matching/scopeFilter';
import { suggestReuse, type ReuseSuggestion } from '../../core/reuse/suggestReuse';

export function suggestReuseForUnboundStep(
    step: FeatureStep,
    bindings: readonly Binding[]
): ReuseSuggestion {
    const sources = bindings
        .filter((binding) => isBindingInScope(binding, step.tagsEffective))
        .map((binding) => ({
            patternRaw: binding.patternRaw,
            methodName: binding.methodName,
            keyword: binding.keyword,
            filePath: binding.uri.fsPath,
            line: binding.lineNumber,
        }));
    return suggestReuse(step.rawText, step.keywordResolved, sources);
}
