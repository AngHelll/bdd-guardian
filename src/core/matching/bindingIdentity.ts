import type { Binding } from '../domain/types';

/** Stable key for the same step definition (across duplicate provider indexes). */
export function getBindingIdentity(binding: Binding): string {
    return `${binding.uri.toString()}\0${binding.lineNumber}\0${binding.methodName}\0${binding.patternRaw}`;
}
