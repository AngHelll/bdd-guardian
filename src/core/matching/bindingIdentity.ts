import type { Binding } from '../domain/types';

/** Stable key for the same step definition (across duplicate provider indexes). */
export function getBindingIdentity(binding: Binding): string {
    // Keyword is part of identity because a single method can legally bind multiple keywords
    // (e.g. [StepDefinition] or multiple attributes).
    return `${binding.uri.toString()}\0${binding.lineNumber}\0${binding.keyword}\0${binding.methodName}\0${binding.patternRaw}`;
}
