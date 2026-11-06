import type { Binding } from '../domain/types';

/**
 * Stable key for one executable method (across duplicate provider indexes
 * and across several attributes on that method).
 * Keyword stays in the key because one method can bind more than one keyword.
 * An unread parameter list falls back to the method line so two overloads are not merged.
 */
export function getBindingIdentity(binding: Binding): string {
    const shape = binding.parameterTypes === undefined
        ? `unparsed:${binding.methodLine ?? binding.lineNumber}`
        : binding.parameterTypes.map((typeName) => typeName.toLowerCase()).join(',');
    return `${binding.uri.toString()}\0${binding.className}\0${binding.methodName}\0${binding.keyword}\0${shape}`;
}
