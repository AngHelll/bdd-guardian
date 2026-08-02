# Binding matching (regex and false "unbound")

How step text is matched to binding patterns, and how we reduce false "binding not found".

## Current behavior

1. **Step text** is normalized when building the feature index: `trim` + collapse runs of spaces/tabs to a single space (`normalizeWhitespace` in `core/matching/normalization.ts`). Scenario Outline placeholders are expanded into multiple candidate strings.
2. **Binding pattern** is compiled in `core/parsing/bindingRegex.ts`:
   - Pattern is normalized the same way (trim + collapse spaces) so it aligns with step text.
   - Literal `$` and `^` (e.g. "Cost is $5") are escaped so they match as characters; anchors at start/end are preserved.
   - Full-step match is enforced (`^...$`).
   - Unicode flag `u` is used.
   - On compile error, fallback to exact literal match so the binding is not dropped.
3. **Resolver** tests each binding’s regex against the step’s candidate texts. If **two or more** bindings match, status is **`ambiguous`** by default (Reqnroll runtime and BDD Pilot `AMBIGUOUS_STEPS` behave similarly). Optional setting `bddGuardian.matching.preferSpecificBinding` (`true`) restores legacy behavior: pick the highest-scoring match as **bound**.

## Implemented (reduces false unbound)

- **Pattern whitespace normalization** — Same trim + collapse as step text. A pattern like `I  have  (\d+)  apples` matches the normalized step `I have 5 apples`.
- **C# verbatim `""`** — Attribute regex captures the full verbatim string so patterns with quoted parts (e.g. `they click on ""(.*)"" in the menu`) are not truncated.
- **Literal `$` / `^`** — Treated as characters when not at start/end of the pattern.
- **Fallback to literal** — Invalid regex pattern still produces a binding that matches the exact text.
- **Ambiguity policy (v0.5.0+)** — Overlapping patterns (e.g. `\d+` vs `.*`) → **ambiguous**, not silent bound. Enable `bddGuardian.matching.preferSpecificBinding` for score-based winner.
- **Ambiguity explained (v1.6.1+)** — Hover and Problems show a short *why* (duplicate pattern, score tie, or broad vs specific). Matching status and scores are unchanged.
- **Scenario Outline candidates** — Placeholders expanded from Examples rows (including Examples on plain `Scenario`); bound if any expanded candidate matches.
- **Cucumber Expressions Wave A** — `{int}`, `{float|double}`, `{word}`, `{string}` compile to regex via `cucumberExpression.ts` when `ExpressionType.CucumberExpression` is set or the pattern looks like CE (`{name}` placeholders, not `\d{2}`).
- **Cucumber Expressions Wave B (v1.10.0+)** —
  - **Optional text** — `(…)` segments are optional (`cucumber(s)` matches `cucumber` and `cucumbers`).
  - **Alternation** — `a/b` outside placeholders compiles to `(?:a|b)` (`a/an {word}` matches both forms).
  - **Built-in type extras** — `long`, `short`, `byte`, `biginteger` (int-like) and `bigdecimal` (decimal-like), case-insensitive.
  - **Unknown `{CustomType}`** — CE compile fails closed (no silent `.*`); existing regex/literal path may apply, but never a CE wildcard.

## Optional improvements (good practice, no relaxation of BDD)

- **`countCaptureGroups`** — Ignore `(` inside character classes `[...]` so the count is correct for display or validation.
- **No second fallback in resolver** — We do not try “match step as literal text against all bindings” when status would be unbound; that could increase false positives. Keeping a single matching path (regex only) preserves predictable behavior.

## Documented limitations

- Lookaheads and complex nested regex groups may differ from the test runner; regex alternation `(a|b)` is covered by the precision corpus.
- Custom Cucumber parameter types (user-defined `{MyType}`) are not discovered from C#; they stay unbound as CE until configured elsewhere (out of scope).
- `[Scope]`-aware matching is not applied (bindings with the same pattern in different scopes may still show as ambiguous).

## Where the code lives

- **Compile pattern:** `src/core/parsing/bindingRegex.ts` (`compileBindingRegex`, `normalizePatternWhitespace`, `escapeLiteralAnchors`).
- **Cucumber Expressions:** `src/core/parsing/cucumberExpression.ts` (`compileCucumberExpressionToRegex`, `looksLikeCucumberExpression`).
- **Step candidates:** `src/core/matching/normalization.ts` (`generateCandidateTexts`, `normalizeWhitespace`).
- **Match and resolve:** `src/core/matching/resolver.ts`, `scoring.ts`.
