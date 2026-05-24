---
name: bdd-binding-matcher
description: Diagnoses and fixes step-to-binding matching in BDD Guardian (bindingRegex, normalization, resolver, Vitest). Use for unbound or ambiguous steps, regex patterns, C# verbatim quotes, or binding matching.
disable-model-invocation: true
---

# BDD Binding Matcher

## Invariants

- One matching path: `compileBindingRegex` → resolver tests regex against step candidate texts.
- No resolver literal fallback against all bindings (see `docs/BINDING_MATCHING.md`).
- Step text and binding patterns both use trim + collapse whitespace (`normalizeWhitespace` / `normalizePatternWhitespace`).

## Workflow

1. **Reproduce** — Minimal case in `src/__tests__/bindingRegex.test.ts`, `resolver.test.ts`, or fixtures under `src/__tests__/fixtures/`.
2. **Trace** — `src/core/matching/normalization.ts` → `src/core/parsing/bindingRegex.ts` → `src/core/matching/resolver.ts` → `scoring.ts`.
3. **Test first** — Add or adjust a failing test, then implement.
4. **Verify** — `npm test` from repo root.
5. **Document** — Update `docs/BINDING_MATCHING.md` only if behavior or documented limitations change.

## Common causes of false unbound

| Symptom | Check |
|---------|--------|
| Extra spaces in pattern vs step | Pattern normalization in `bindingRegex.ts`; step side in `normalization.ts` |
| C# quoted segments | Verbatim `""` in attribute; tests in `bindingRegex.test.ts` |
| Literal `$` or `^` | `escapeLiteralAnchors` |
| Invalid regex | Literal fallback in `compileBindingRegex`; binding should not disappear |
| Scenario Outline | `generateCandidateTexts` / example expansion tests |

## References

- [docs/BINDING_MATCHING.md](../../../docs/BINDING_MATCHING.md)
- [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) — Resolver, Scoring
- `src/core/parsing/bindingRegex.ts`
- `src/core/matching/resolver.ts`
