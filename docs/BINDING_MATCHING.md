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
3. **Resolver** tests each binding’s regex against the step’s candidate texts; the best match (by score) is chosen.

## Implemented (reduces false unbound)

- **Pattern whitespace normalization** — Same trim + collapse as step text. A pattern like `I  have  (\d+)  apples` matches the normalized step `I have 5 apples`.
- **C# verbatim `""`** — Attribute regex captures the full verbatim string so patterns with quoted parts (e.g. `they click on ""(.*)"" in the menu`) are not truncated.
- **Literal `$` / `^`** — Treated as characters when not at start/end of the pattern.
- **Fallback to literal** — Invalid regex pattern still produces a binding that matches the exact text.

## Optional improvements (good practice, no relaxation of BDD)

- **`countCaptureGroups`** — Ignore `(` inside character classes `[...]` so the count is correct for display or validation.
- **No second fallback in resolver** — We do not try “match step as literal text against all bindings” when status would be unbound; that could increase false positives. Keeping a single matching path (regex only) preserves predictable behavior.

## Documented limitations

README **Known Issues** states that advanced regex (alternations `|`, lookaheads, complex groups) may behave differently from the test runner. Prefer simple capture groups and literal text when possible.

## Where the code lives

- **Compile pattern:** `src/core/parsing/bindingRegex.ts` (`compileBindingRegex`, `normalizePatternWhitespace`, `escapeLiteralAnchors`).
- **Step candidates:** `src/core/matching/normalization.ts` (`generateCandidateTexts`, `normalizeWhitespace`).
- **Match and resolve:** `src/core/matching/resolver.ts`, `scoring.ts`.
