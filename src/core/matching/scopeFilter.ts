/**
 * Scope-aware binding filter (Reqnroll `[Scope(Tag=…)]`).
 *
 * Policy (v1.11.0):
 * - Empty scopeTags → global (always in scope).
 * - Non-empty scopeTags → in scope if any scope tag matches step.tagsEffective (OR).
 * - Step with no tags → scoped bindings are out of scope.
 * - Tag compare: case-insensitive; leading `@` optional on either side.
 */

import { Binding } from '../domain/types';

/** Normalize a Gherkin or Scope tag for comparison. */
export function normalizeScopeTag(tag: string): string {
    return tag.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Whether a binding participates in resolve for this step's effective tags.
 */
export function isBindingInScope(
    binding: Binding,
    tagsEffective: readonly string[]
): boolean {
    const scopeTags = binding.scopeTags ?? [];
    if (scopeTags.length === 0) {
        return true;
    }

    const stepTags = new Set(
        tagsEffective.map(normalizeScopeTag).filter((t) => t.length > 0)
    );
    if (stepTags.size === 0) {
        return false;
    }

    return scopeTags.some((t) => stepTags.has(normalizeScopeTag(t)));
}
