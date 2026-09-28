/**
 * Map in-scope bindings to reuse / closed-step advice.
 * Call only after resolve status is unbound.
 */

import type { Binding, FeatureStep } from '../../core/domain';
import { isBindingInScope } from '../../core/matching/scopeFilter';
import { suggestClosedStep } from '../../core/reuse/closedStep';
import { suggestReuse, type ReuseBindingSource } from '../../core/reuse/suggestReuse';

export type UnboundAdvice =
    | { readonly kind: 'similar'; readonly humanized: string; readonly methodName: string }
    | { readonly kind: 'closed'; readonly word: string; readonly humanized: string; readonly methodName: string }
    | { readonly kind: 'none' };

function sourcesFor(step: FeatureStep, bindings: readonly Binding[]): ReuseBindingSource[] {
    return bindings
        .filter((binding) => isBindingInScope(binding, step.tagsEffective))
        .map((binding) => ({
            patternRaw: binding.patternRaw,
            methodName: binding.methodName,
            keyword: binding.keyword,
            filePath: binding.uri.fsPath,
            line: binding.lineNumber,
        }));
}

export function unboundAdvice(step: FeatureStep, bindings: readonly Binding[]): UnboundAdvice {
    const sources = sourcesFor(step, bindings);
    const reuse = suggestReuse(step.rawText, step.keywordResolved, sources);
    if (reuse.kind === 'reuse') {
        return { kind: 'similar', humanized: reuse.humanized, methodName: reuse.methodName };
    }
    const closed = suggestClosedStep(step.rawText, step.keywordResolved, sources);
    if (closed.kind === 'useSlot') {
        return { kind: 'similar', humanized: closed.humanized, methodName: closed.methodName };
    }
    if (closed.kind === 'parameterize') {
        return {
            kind: 'closed',
            word: closed.word,
            humanized: closed.humanized,
            methodName: closed.methodName,
        };
    }
    return { kind: 'none' };
}
