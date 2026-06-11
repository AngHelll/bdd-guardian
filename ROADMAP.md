# BDD Guardian — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v0.8.3** · **217 unit tests** · Marketplace en v0.7.2 hasta publish explícito (Capa C)

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped | v0.1.0 → **v0.7.2** Marketplace · **v0.8.2–v0.8.3** Index API v1 + `resolveStep` (repo; publish pendiente) |
| 🎯 Next | **v0.9.0** — Java Cucumber · **v0.9.1** — bindings UX hygiene (spec lista) |
| 🏁 Goal | **v1.0.0** — stable public release with multi-framework navigation |

**Companion extensions:** [BDD Pilot](https://github.com/AngHelll/bdd-pilot) (execution) · [BDD Jarvis](https://github.com/AngHelll/bdd-jarvis) (automation intelligence, consumes Index API v1). Guardian = navigation, bindings & index API.

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
| **0.5.1** | Matching patch — portfolio corpus unskipped, CodeLens disk resolve, SpecFlow detect tests |
| **0.5.0** | Binding alignment — SpecFlow = Reqnroll parser, ambiguity policy, outline corpus |
| **0.6.0** | Wave A precision foundation — Cucumber Expressions + StepDefinition (Reqnroll / future JS) |
| **0.6.1** | First complete non-C# provider — Cucumber.js (JS/TS) |
| **0.6.2** | Coach quick fixes batch + JS indexing/UX polish |
| **0.7.0** | Godog provider (Go) + detection report polish |
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

## Plan v0.7.0 — ✅ shipped (2026-06-01)

| # | Status |
|---|--------|
| **0.7.0-1** Godog provider MVP | ✅ |
| **0.7.0-2** `samples/godog-demo` Capa B | ✅ |
| **0.7.0-3** Detection summary in Output + reindex detect | ✅ |
| **0.7.0-4** VSIX + Marketplace | ✅ |

**Exit criteria met:** `godog-demo` indexes Go bindings; C# + JS demos unchanged.

---

## Plan v0.6.2 — ✅ shipped (2026-06-01)

| # | Status |
|---|--------|
| **0.6.2-1** Coach quick fixes batch | ✅ |
| **0.6.2-2** js-cucumber glob polish | ✅ |
| **0.6.2-2b** Indexing + hover + reindex UX | ✅ |
| **0.6.2-3** CHANGELOG + roadmap | ✅ |
| **0.6.2-4** VSIX + Marketplace | ✅ |

**Exit criteria met:** `cucumber-demo` indexes JS bindings; `binding-demo` unchanged for C# Capa B.

### Follow-up v0.5.1 — ✅ shipped

- Portfolio alternation — precision corpus enabled; outline + `(option|…)` groups match Reqnroll-style patterns
- CodeLens closed-tab resolve reads `.feature` from disk before literal fallback
- SpecFlow `detect()` regression tests for Reqnroll exclusivity

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
- [x] Non-C# provider verified (cucumber-demo v0.6.1+, godog-demo v0.7.0)

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

## Plan v0.9.0 — Java Cucumber provider (alineado 2026-06-02, renumerado de v0.8.0 el 2026-06-11)

| # | Item |
|---|------|
| **0.9.0-1** | `javaCucumberBindingParser` + tests |
| **0.9.0-2** | `javaCucumberProvider` detect (Maven/Gradle) + index |
| **0.9.0-3** | `samples/java-cucumber-demo` Capa B |
| **0.9.0-4** | CHANGELOG + VSIX |

**Exit criteria:** demo Java indexa bindings; demos C#/JS/Go/Python sin regresión.

Spec: `docs-internal/specs/java-cucumber-provider-v0.9.0.md` (local).

## Plan v0.9.1 — bindings UX hygiene (alineado 2026-06-02, renumerado de v0.8.1 el 2026-06-11)

| # | Item |
|---|------|
| **0.9.1-1** | Diagnostic source `BDD Guardian` |
| **0.9.1-2** | i18n status labels + `showMatchScore` setting |
| **0.9.1-3** | README settings map + CHANGELOG |
| **0.9.1-4** | VSIX |

Spec: `docs-internal/specs/bindings-ux-hygiene-v0.9.1.md` (local). Tras v0.9.0 Java.

---

## Plan v0.7.2 — ✅ shipped (2026-06-02)

| # | Status |
|---|--------|
| **0.7.2-1** Setting `bddGuardian.providers.indexMode` | ✅ |
| **0.7.2-2** `IndexManager` primary-only indexing | ✅ |
| **0.7.2-3** Output + provider report + tests | ✅ |
| **0.7.2-4** CHANGELOG + VSIX | ✅ |

---

## Plan v0.7.1 — ✅ shipped (2026-06-02)

| # | Status |
|---|--------|
| **0.7.1-1** `pythonBehaveBindingParser` + tests | ✅ |
| **0.7.1-2** `pythonBehaveProvider` detect + index | ✅ |
| **0.7.1-3** `samples/behave-demo` Capa B | ✅ |
| **0.7.1-4** CHANGELOG + VSIX | ✅ |

**Exit criteria met:** `behave-demo` indexes Python bindings; C#/JS/Go demos unchanged.

---

## Post-v0.5.0 backlog (prioritized)

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | ~~**Portfolio alternation matching**~~ | ✅ v0.5.1 — precision corpus enabled |
| P1 | **Cucumber JS provider** (complete stub) | First non-C#; broadest audience |
| P1 | Matching edge cases (optional) | `countCaptureGroups`, alternations — see BINDING_MATCHING.md |
| P2 | ~~**Behave provider**~~ | ✅ v0.7.1 — `samples/behave-demo` |
| P2 | Coach: more rules + quick fixes | un Then dominante, imperativo, tags redundantes |
| P2 | **Godog provider** | Go BDD |
| P3 | Step autocomplete | Productivity; needs index API |
| P3 | Generate binding from unbound step | Complements Pilot `PENDING_STEPS` |
| P3 | Copy as pattern code action | DX for binding authors |
| P4 | Shared `@anghelll/bdd-gherkin-lite` with Pilot | Wait until parsers stabilize |
| P4 | Onboarding GIF / empty workspace hint | Marketplace conversion |
| P2 | **Java Cucumber provider** | plan v0.9.0 alineado — último stack JVM |

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

*Last updated: 2026-06-11 — v0.8.3 Index API ship; planes Java/UX renumerados a v0.9.x.*
