/**
 * Resolve which binding providers should be indexed for the current workspace.
 */

import type { IBindingProvider, ProviderSelection } from '../../providers/bindings/types';

export type ProviderIndexMode = 'all' | 'primary';

export function resolveProvidersToIndex(
    selection: ProviderSelection,
    mode: ProviderIndexMode
): IBindingProvider[] {
    if (mode === 'primary') {
        return selection.primary ? [selection.primary] : [];
    }

    if (selection.active.length > 0) {
        return [...selection.active];
    }

    return selection.primary ? [selection.primary] : [];
}

export function formatIndexingModeLog(
    mode: ProviderIndexMode,
    providers: readonly IBindingProvider[]
): string {
    if (mode === 'primary') {
        const name = providers[0]?.displayName ?? 'none';
        return `primary (${name})`;
    }
    if (providers.length === 0) {
        return 'all (no providers to index)';
    }
    return `all (${providers.map((p) => p.displayName).join(', ')})`;
}
