# BDD Guardian — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v0.5.0** · **164 unit tests**

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped | v0.1.0 → **v0.5.0** (see [CHANGELOG.md](./CHANGELOG.md)) |
| 🎯 Next | **v0.6.0** — Cucumber JS provider (first non-C#) |
| 🏁 Goal | **v1.0.0** — stable public release with multi-framework navigation |

**Companion extension:** [BDD Pilot](https://github.com/AngHelll/bdd-pilot) (test execution). Guardian = navigation & bindings.

**Deep docs:** [docs/README.md](./docs/README.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [docs/BINDING_MATCHING.md](./docs/BINDING_MATCHING.md)

---

## Product layers

| Layer | Objective |
|-------|-----------|
| **Core** | Index + matching (regex, scoring) — framework-agnostic |
| **Providers** | Binding detection per language/framework |
| **VS Code UX** | CodeLens, go to definition, diagnostics, decorations, history |
| **Coach** | Optional `.feature` quality rules (non-blocking) |

**Explicitly not MVP:** step autocomplete, generate binding from step, copy-as-pattern — see [backlog](#post-v050-backlog).

---

## Versioning (0.x)

| Version | Milestone |
|---------|-----------|
| **0.4.x** | Matching polish, Find All References, live index, i18n EN/ES, agent docs |
| **0.5.0** | Binding alignment — SpecFlow = Reqnroll parser, ambiguity policy, outline corpus |
| **0.6.0** | First complete non-C# provider (Cucumber JS) + Coach quick fixes batch |
| **0.7.0** | Godog provider; provider detection report polish |
| **1.0.0** | Stable API, marketplace-ready docs, regression suite on sample workspace |

---

## Shipped (summary)

### v0.5.0 — Binding alignment (SRBA)

- **Shared C# parser** for Reqnroll and SpecFlow providers
- **Ambiguity policy** default Reqnroll-like (`ambiguous` when ≥2 bindings match); optional `preferSpecificBinding`
- **Scenario Outline** — Examples on plain Scenario; refresh candidates when Examples follow steps
- **Precision corpus** regression suite (`matching-corpus`)
- **164 tests** (1 skipped: portfolio alternation → v0.5.1)

### v0.4.2 — References & live index

- **Find All References** (Shift+F12) on steps and bindings via `core/references`
- **Live index** while editing `.feature` (debounced buffer); bindings replaced per file on save
- **Pattern whitespace** normalization; `docs/BINDING_MATCHING.md`
- **Maintainer DX:** local Cursor rules + `verify:local` workflow (not shipped in VSIX)
- **147 tests**

### v0.4.0 — Architecture unification

- Single index path (IndexManager + providers + core resolver)
- Unified Gherkin parser (Coach + navigation)
- C# verbatim `""` in patterns; branding "BDD Guardian"
- UI language `bddGuardian.displayLanguage` (en/es)

### v0.3.0 — Test infrastructure

- Vitest suite expansion; matching-corpus fixtures; coverage on core matching

### v0.2.0 / v0.1.0 — Navigation MVP

- CodeLens, diagnostics, decorations, navigation history, Coach v1

*Full notes in [CHANGELOG.md](./CHANGELOG.md).*

---

## Plan v0.6.0

Concrete path from **v0.5.0** → first non-C# provider. Small PRs; dogfood on `samples/binding-demo` before merging.

### Milestone 0.6.0 — Cucumber JS provider

| # | Issue title | Scope | Done when |
|---|-------------|-------|-----------|
| **0.6.0-1** | `feat(provider): Cucumber JS binding detection` | `jsCucumberProvider.ts`, tests | `.ts` step defs index; CodeLens bound on sample |
| **0.6.0-2** | `test: provider smoke in verify-local` | fixtures or `samples/` | Capa A passes with JS fixture |
| **0.6.0-3** | `docs: PROVIDERS.md + README Cucumber JS` | docs | User can enable JS project |
| **0.6.0-4** | `release: v0.6.0 VSIX + Marketplace` | CHANGELOG, tag | Capa B OK on binding-demo + JS sample |

**Exit criteria:** Open a repo with `.feature` + `.ts` bindings; Guardian indexes both without manual config beyond globs.

### Follow-up v0.5.1 (optional patch)

- Portfolio alternation regex (`|`) alignment with Reqnroll runtime — precision corpus test currently skipped

*v0.5.0 shipped binding alignment instead of Cucumber JS (see [CHANGELOG.md](./CHANGELOG.md)).*

---

### Marketplace readiness checklist

Use before clicking **Publish**:

#### Product
- [x] Install from `.vsix` on clean VS Code
- [x] CodeLens bound/unbound/ambiguous on C# Reqnroll repo
- [x] Go to Definition step ↔ binding
- [x] Find All References (Shift+F12)
- [x] Coach optional (`bddGuardian.coach.enabled`)
- [x] i18n EN/ES for UI strings
- [x] Dogfood on `samples/binding-demo` after each release (Capa B OK 2026-05-31, v0.5.0)
- [ ] Non-C# provider verified (post v0.6.0)

#### Repo & brand
- [x] `CHANGELOG.md` through current version
- [x] GitHub Release with `.vsix` (verify latest tag)
- [x] README links BDD Pilot; Pilot links back
- [x] Issue templates (bug, feature)
- [x] License MIT, publisher `anghelll`

#### Technical
- [x] `npm test` (lint + vitest) in CI Node 18/20
- [x] VSIX artifact in CI
- [x] `npm run verify:local` in maintainer workflow (Capa A OK pre-publish v0.5.0)
- [x] `engines.vscode` ^1.85.0

#### Post-publish
- [x] Watch issues 1–2 weeks; patch if matching regressions (iniciado 2026-05-31, v0.5.0)
- [ ] Good first issue: Cucumber JS provider or Coach rule

---

## Post-v0.5.0 backlog (prioritized)

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | **Portfolio alternation matching** | Precision corpus `@skip`; align `\|` with Reqnroll |
| P1 | **Cucumber JS provider** (complete stub) | First non-C#; broadest audience |
| P1 | Matching edge cases (optional) | `countCaptureGroups`, alternations — see BINDING_MATCHING.md |
| P2 | **Behave provider** | Python BDD teams |
| P2 | Coach: more rules + quick fixes | un Then dominante, imperativo, tags redundantes |
| P2 | **Godog provider** | Go BDD |
| P3 | Step autocomplete | Productivity; needs index API |
| P3 | Generate binding from unbound step | Complements Pilot `PENDING_STEPS` |
| P3 | Copy as pattern code action | DX for binding authors |
| P4 | Shared `@anghelll/bdd-gherkin-lite` with Pilot | Wait until parsers stabilize |
| P4 | Onboarding GIF / empty workspace hint | Marketplace conversion |

---

## Architecture (reference)

```
src/
├── core/              # Pure logic — Vitest tested, no VS Code API
│   ├── domain/        # types, constants
│   ├── index/         # workspace index, file watchers
│   ├── parsing/       # gherkin, binding regex, C# parser
│   ├── matching/      # resolver, scoring, normalization
│   └── references/    # find references headless-ready
├── providers/bindings/  # per-framework binding providers
├── features/          # VS Code UI (navigation, diagnostics, coach, hover)
├── i18n/              # en.json, es.json
└── extension.ts
```

**Principles:** framework-agnostic core · single regex compiler · incremental index · Pilot runs tests, Guardian navigates.

---

*Last updated: 2026-05-31 — v0.5.0 binding alignment shipped.*
