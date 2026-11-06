/**
 * Scope-aware binding filter (Reqnroll `[Scope]`).
 *
 * A binding with no rules is global (scopeMatches 0).
 * Criteria inside one rule are AND. Rules are OR.
 * Each criterion that matches adds 1. The resolver keeps the highest count.
 *
 * Tag compare: case-insensitive; leading `@` optional on either side.
 * Feature and scenario titles: trim, case-insensitive, invariant lowercase.
 */

import { Binding, BindingScopeRule } from '../domain/types';

export interface ScopeMatchContext {
    readonly tags: readonly string[];
    readonly featureTitle?: string;
    readonly scenarioTitle?: string;
}

export interface ScopeMatch {
    readonly inScope: boolean;
    /** 0 for a global binding. Higher means more criteria matched. */
    readonly scopeMatches: number;
}

/** Normalize a Gherkin or Scope tag for comparison. */
export function normalizeScopeTag(tag: string): string {
    return tag.trim().replace(/^@+/, '').toLowerCase();
}

function normalizeTitle(title: string): string {
    return title.trim().toLowerCase();
}

/** Rules stored on the binding, or one rule per legacy `scopeTags` entry. */
export function scopeRulesOf(binding: Binding): readonly BindingScopeRule[] {
    if (binding.scopes && binding.scopes.length > 0) {
        return binding.scopes;
    }
    const tags = binding.scopeTags ?? [];
    return tags
        .map((tag) => tag.trim().replace(/^@+/, ''))
        .filter((tag) => tag.length > 0)
        .map((tag) => ({ tag }));
}

function scoreRule(rule: BindingScopeRule, ctx: ScopeMatchContext): number | null {
    let score = 0;
    if (rule.tag !== undefined && rule.tag.length > 0) {
        const needed = normalizeScopeTag(rule.tag);
        const hasTag = ctx.tags.some((tag) => normalizeScopeTag(tag) === needed && needed.length > 0);
        if (!hasTag) {
            return null;
        }
        score++;
    }
    if (rule.feature !== undefined && rule.feature.length > 0) {
        if (ctx.featureTitle === undefined || normalizeTitle(rule.feature) !== normalizeTitle(ctx.featureTitle)) {
            return null;
        }
        score++;
    }
    if (rule.scenario !== undefined && rule.scenario.length > 0) {
        if (ctx.scenarioTitle === undefined || normalizeTitle(rule.scenario) !== normalizeTitle(ctx.scenarioTitle)) {
            return null;
        }
        score++;
    }
    if (score === 0) {
        return null;
    }
    return score;
}

/**
 * Whether the binding may run for this step, and how many scope criteria matched.
 * A global binding is always in scope with `scopeMatches` 0.
 */
export function matchBindingScope(binding: Binding, ctx: ScopeMatchContext): ScopeMatch {
    const rules = scopeRulesOf(binding);
    if (rules.length === 0) {
        return { inScope: true, scopeMatches: 0 };
    }

    let best = -1;
    for (const rule of rules) {
        const score = scoreRule(rule, ctx);
        if (score !== null && score > best) {
            best = score;
        }
    }
    if (best < 0) {
        return { inScope: false, scopeMatches: 0 };
    }
    return { inScope: true, scopeMatches: best };
}

/**
 * Whether a binding participates in resolve for this step's effective tags.
 * Feature and scenario titles are optional; without them a title criterion does not match.
 */
export function isBindingInScope(
    binding: Binding,
    tagsEffective: readonly string[],
    titles?: { featureTitle?: string; scenarioTitle?: string }
): boolean {
    return matchBindingScope(binding, {
        tags: tagsEffective,
        featureTitle: titles?.featureTitle,
        scenarioTitle: titles?.scenarioTitle,
    }).inScope;
}
