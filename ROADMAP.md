# BDD Guardian — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v1.15.0** GitHub: [v1.15.0](https://github.com/AngHelll/bdd-guardian/releases/tag/v1.15.0)

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped | v0.1.0 → **v1.15.0** (GitHub) |
| 🎯 Next | (dogfood mapa / next align) |
| 📋 Gate | *alineado, pasa a spec* |
| 🏁 Goal | **v1.x** — mapa + Coach ✅ → suite glue ✅ → platform ✅ → claridad de señal → **mapa como objeto** |

**Companion extensions:** [BDD Pilot](https://github.com/AngHelll/bdd-pilot) (execution). Guardian = navigation, bindings & index API.

**Deep docs:** [docs/README.md](./docs/README.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [docs/BINDING_MATCHING.md](./docs/BINDING_MATCHING.md)

---

## Product layers

| Layer | Objective |
|-------|-----------|
| **Core** | Index + matching (regex, scoring) — framework-agnostic |
| **Providers** | Binding detection per language/framework |
| **VS Code UX** | CodeLens, go to definition, diagnostics, decorations, history |
| **Coach** | Optional `.feature` quality rules (non-blocking) |

**v1.4.0:** Coach rules oleada — ✅ shipped.  
**v1.4.1:** Guardian ↔ Pilot handoff — ✅ shipped.  
**v1.5.0:** Generate Behave/Go/Java — ✅ shipped.  
**v1.6.0:** `guardian-cli` — ✅ shipped.  
**v1.6.1:** Ambiguous explicado — ✅ shipped.  
**v1.6.2:** ForgeOne README family + Iconography — ✅ shipped (Guardian↔Pilot; sin Jarvis).  
**v1.7.0:** Marketplace tile Opción B — see [Plan v1.7.0](#plan-v170--implementado-2026-07-20).

---

## Versioning

| Version | Milestone |
|---------|-----------|
| **0.4.x** | Matching polish, Find All References, live index, i18n EN/ES, agent docs |
| **0.5.1** | Matching patch — portfolio corpus unskipped, CodeLens disk resolve, SpecFlow detect tests |
| **0.5.0** | Binding alignment — SpecFlow = Reqnroll parser, ambiguity policy, outline corpus |
| **0.6.0** | Wave A precision foundation — Cucumber Expressions + StepDefinition (Reqnroll / future JS) |
| **0.6.1** | First complete non-C# provider — Cucumber.js (JS/TS) |
| **0.6.2** | Coach quick fixes batch + JS indexing/UX polish |
| **0.7.0** | Godog provider (Go) + detection report polish |
| **0.8.2–0.8.3** | Index API v1 (`extension.exports`) + `resolveStep` v1.1 for BDD Jarvis |
| **0.9.0** | Java Cucumber-JVM provider (fifth complete framework) |
| **0.9.1** | Bindings UX hygiene — diagnostic source, i18n labels, `showMatchScore` |
| **1.0.0** | Stable API, marketplace-ready docs, communication + visual polish |
| **1.0.1** | Framework-aware hover + onboarding GIF *(shipped 2026-07-12)* |
| **1.1.0** | Binding author DX — copy pattern, generate scaffold *(shipped 2026-07-12)* |
| **1.2.0** | Step autocomplete from indexed bindings *(shipped 2026-07-15)* |
| **1.3.0** | Orphan / unused binding diagnostics *(shipped 2026-07-15)* |
| **1.4.0** | Coach rules — dominant Then + redundant tags *(shipped 2026-07-15)* |
| **1.4.1** | Guardian ↔ Pilot handoff ✅ |
| **1.5.0** | Generate binding Behave / Godog / Java ✅ |
| **1.6.0** | `guardian-cli` discover / analyze ✅ |
| **1.6.1** | Ambiguous explicado ✅ |
| **1.6.2** | ForgeOne README family + Iconography ✅ (sin Jarvis) |
| **1.8.0** | `guardian-cli` v2 + MCP stdio ✅ |
| **1.9.0** | Map signal clarity — `feedbackLevel` presets + namespace hygiene ✅ |
| **1.10.0** | Cucumber Expressions Wave B — optional text, alternation CE, built-in types extras |
| **1.11.0** | Scope-aware matching — `[Scope(Tag=…)]` Reqnroll |
| **1.12.0** | Suite map — Explorer view of unbound / ambiguous / orphan holes |
| **1.13.0** | Suite map ola 2 — group holes by file + generate/copy from unbound |
| **1.14.0** | Suite map ola 3 — Explain ambiguous holes from the map |
| **1.15.0** | Unbound explained — hover / Problems / Map / CLI `why` |

---

## Plan v1.15.0 — verificado (2026-09-04)

| # | Status |
|---|--------|
| **1.15.0-A** `explainUnbound` puro + tests | ✅ |
| **1.15.0-B** Hover + Problems + Map Explain unbound + CLI `why` | ✅ |
| **1.15.0-C** i18n / docs / CHANGELOG | ✅ |
| **1.15.0-4** VSIX + Marketplace | ☐ Marketplace (*publish* en curso) |

Spec: `docs-internal/specs/unbound-explained-v1.15.0.md` (local).  
**Anti-scope:** matching, fallback literal, near-miss, generate, Coach, orphans, mapa estructural, Activity Bar/webview, Index API v2, schema CLI/MCP, Pilot.

**Exit criteria:** `binding-demo` `@v111` untagged hover/Problems/Map why = scopeExcluded; Generate unbound intacto; `@web`/`@api` siguen bound; Capa B fijos OK.

---

## Plan v1.14.0 — verificado (2026-09-01)

| # | Status |
|---|--------|
| **1.14.0-A** `explainAmbiguousHole` puro + tests | ✅ |
| **1.14.0-B** Acción inline Explain en ambiguous (QuickPick + why) | ✅ |
| **1.14.0-C** i18n / docs / CHANGELOG | ✅ |
| **1.14.0-4** VSIX + Marketplace | ✅ Marketplace + GitHub Release |

Spec: `docs-internal/specs/suite-map-ola3-v1.14.0.md` (local).  
**Anti-scope:** matching, Activity Bar, webview, listar bound, árbol por escenario, Coach, Pilot Run, generate en ambiguous, orphan actions, MCP/CLI schema, Index API v2, rename.

**Exit criteria:** `binding-demo` `@v050` ambiguous tiene Explain; why = hover; pick abre binding; Generate unbound intacto; `authorActions.enabled: false` no oculta Explain; Capa B fijos OK.

---

## Plan v1.13.0 — verificado (2026-08-21)

| # | Status |
|---|--------|
| **1.13.0-A** `groupHolesByUri` + TreeView anidado por archivo | ✅ |
| **1.13.0-B** Acción inline Generate/Copy en unbound (comandos author) | ✅ |
| **1.13.0-C** i18n / docs / CHANGELOG | ✅ |
| **1.13.0-4** VSIX + Marketplace | ✅ Marketplace + GitHub Release |

Spec: `docs-internal/specs/suite-map-ola2-v1.13.0.md` (local).  
**Anti-scope:** matching, Activity Bar, webview, listar bound, árbol por escenario, Coach, Pilot Run, MCP/CLI schema, Index API v2, rename.

**Exit criteria:** `binding-demo` agrupa unbound bajo `sample.feature`; Generate desde el mapa reusa author; `authorActions.enabled: false` oculta la acción; Capa B fijos OK.

---

## Plan v1.12.0 — verificado (2026-08-16)

| # | Status |
|---|--------|
| **1.12.0-A** `summarizeSuiteMap` puro + tests (binding-demo `@v111` unbound) | ✅ |
| **1.12.0-B** TreeView Explorer “BDD Map” + jump + refresh | ✅ |
| **1.12.0-C** Setting / comando / i18n / docs | ✅ |
| **1.12.0-4** CHANGELOG + VSIX + Marketplace | ✅ Marketplace; tag GitHub Stage 6 |

Spec: `docs-internal/specs/suite-map-v1.12.0.md` (local).  
**Anti-scope:** matching, Activity Bar, webview, listar bound, árbol por feature, Coach, Pilot, CLI/MCP schema, Index API v2.

**Exit criteria:** vista en `binding-demo` muestra huecos alineados con CodeLens; click abre línea; setting off; `feedbackLevel` no oculta la vista.

---

## Plan v1.11.0 — ✅ shipped (2026-08-04)

| # | Status |
|---|--------|
| **1.11.0-A** Parse `[Scope(Tag=…)]` → `Binding.scopeTags` (método/clase) | ✅ |
| **1.11.0-B** Resolver filtra por `tagsEffective` + política documentada | ✅ |
| **1.11.0-C** Dogfood `@v111` + tests + BINDING_MATCHING | ✅ |
| **1.11.0-4** CHANGELOG + VSIX + GitHub Release | ✅ (Marketplace: *publish* explícito) |

Spec: `docs-internal/specs/scope-aware-matching-v1.11.0.md` (local).  
**Anti-scope:** `Feature=`/`Scenario=` path scopes, cambiar `tagFilter` UI, Pilot, CE Wave C.

**Exit criteria:** mismo patrón + scopes distintos → bound correcto por tags; sin Scope regresión ambiguous/CE; Capa B `@v111` OK.

---

## Plan v1.10.0 — ✅ shipped (2026-08-01)

| # | Status |
|---|--------|
| **1.10.0-A** Optional text + alternation in `cucumberExpression.ts` | ✅ |
| **1.10.0-B** Built-in CE types extras (`long`/`bigdecimal`/…) + unknown stays closed | ✅ |
| **1.10.0-C** Corpus/tests + `@v110` dogfood `binding-demo` + BINDING_MATCHING | ✅ |
| **1.10.0-4** CHANGELOG + VSIX + Marketplace | ✅ |

Spec: `docs-internal/specs/cucumber-expressions-wave-b-v1.10.0.md` (local).  
**Anti-scope:** `[Scope]`, custom types vía settings, motor CE embebido, fallback literal resolver.

**Exit criteria:** optional/alternation/tipos extras bound en tests + Capa B `@v110`; Wave A + regex sin regresión.

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

---

## Plan v0.8.2–v0.8.3 — ✅ shipped (2026-06-11)

| # | Status |
|---|--------|
| **0.8.2-1** Index API v1 (`isReady`, `getSnapshot`, `onDidChangeIndex`) | ✅ |
| **0.8.2-2** `docs/EXTENSION_API.md` + snapshot mapper tests | ✅ |
| **0.8.3-1** `resolveStep` v1.1 (bound/unbound/ambiguous) | ✅ |
| **0.8.3-2** Vitest `stepResolve.test.ts` + tag `v0.8.3` | ✅ |

**Exit criteria met:** Jarvis consume contrato v1; Capa B `binding-demo` OK; publish Marketplace pendiente.

Spec: `docs-internal/specs/guardian-index-api-v0.8.2.md` (local).

---

## Plan v0.9.0 — ✅ shipped (2026-06-11)

| # | Status |
|---|--------|
| **0.9.0-1** `javaCucumberBindingParser` + tests | ✅ |
| **0.9.0-2** `javaCucumberProvider` detect (Maven/Gradle) + index | ✅ |
| **0.9.0-3** `samples/java-cucumber-demo` Capa B | ✅ |
| **0.9.0-4** CHANGELOG + VSIX + tag | ✅ |

**Exit criteria met:** demo Java indexa bindings; demos C#/JS/Go/Python sin regresión; Capa B OK.

Spec: `docs-internal/specs/java-cucumber-provider-v0.9.0.md` (local).

Spec: `docs-internal/specs/bindings-ux-hygiene-v0.9.1.md` (local).

---

## Plan v1.0.0 — ✅ shipped (2026-07-09)

| # | Status |
|---|--------|
| **1.0.0-A** Communication polish (i18n ES, README, Marketplace copy) | ✅ |
| **1.0.0-B** Visual identity (`VISUAL_LANGUAGE.md`, CodeLens icons, icon optimize) | ✅ |
| **1.0.0-C** Marketplace onboarding (zero-bindings hint) | ✅ |
| **1.0.0-4** CHANGELOG + VSIX + Marketplace | ✅ |

Specs: `communication-polish-v1.0.0.md`, `visual-identity-v1.0.0.md`, `marketplace-onboarding-v1.0.0.md` (local).

---

## Plan v1.7.0 — ✅ shipped (2026-07-20)

| # | Status |
|---|--------|
| **1.7.0-A** SVG tile + glyph Guardian (Opción B) | ☑ |
| **1.7.0-B** `icon.png` + galleryBanner navy + archive ladybug | ☑ |
| **1.7.0-3** README Iconography + CHANGELOG + VSIX | ☑ (VSIX via verify) |

Spec: `docs-internal/specs/marketplace-tile-v1.7.0.md` (local).  
**Después de** v1.6.2 docs.

**Exit criteria:** shelf familia con Pilot; gutter sin regresión; Capa B fijos OK.

---

## Plan v1.6.2 — ✅ shipped (2026-07-20)

| # | Status |
|---|--------|
| **1.6.2-A** README family table + ForgeOne one-liner | ☑ |
| **1.6.2-B** README Iconography (assets actuales) | ☑ |
| **1.6.2-3** VISUAL_LANGUAGE note + CHANGELOG + VSIX | ☑ |

Spec: `docs-internal/specs/forgeone-readme-family-v1.6.2.md` (local).  
**Antes de** v1.7.0 tile. **Sin Jarvis** (no publicado).

**Exit criteria:** paridad narrativa con Pilot README (Guardian↔Pilot); Capa B fijos OK.

---

## Plan v1.6.1 — ✅ shipped (2026-07-20)

| # | Status |
|---|--------|
| **1.6.1-A** `explainAmbiguity` puro + tests | ☑ |
| **1.6.1-B** Hover + Problems why line | ☑ |
| **1.6.1-3** i18n + BINDING_MATCHING/CHANGELOG + VSIX | ☑ |

Spec: `docs-internal/specs/ambiguous-explained-v1.6.1.md` (local).

**Exit criteria:** binding-demo ambiguous hover/Problems muestran why; matching policy intacta; Capa B fijos OK.

---

## Plan v1.6.0 — ✅ shipped (2026-07-20)

| # | Status |
|---|--------|
| **1.6.0-A** CLI entry + `discover` JSON | ☑ |
| **1.6.0-B** `analyze` counts (bound/unbound/ambiguous/orphan) | ☑ |
| **1.6.0-3** Docs CLI + CHANGELOG + VSIX regresión | ☑ |

Spec: `docs-internal/specs/guardian-cli-v1.6.0.md` (local).  
**Después de** v1.5.0. Tech: T-D05.

**Exit criteria:** `npm run guardian -- analyze samples/binding-demo` JSON OK; Capa B fijos OK.

---

## Plan v1.5.0 — ✅ shipped (2026-07-20)

| # | Status |
|---|--------|
| **1.5.0-A** `supportsScaffoldInsert` + paths Behave/Go/Java | ☑ |
| **1.5.0-B** New-file builders + wire authorCommands | ☑ |
| **1.5.0-3** README + CHANGELOG + VSIX | ☑ |

Spec: `docs-internal/specs/generate-stacks-v1.5.0.md` (local).  
**Antes de** v1.6.0 CLI.

**Exit criteria:** generate en ≥1 demo no-C#/JS; C#/JS regresión; Capa B fijos OK.

---

## Plan v1.4.1 — ✅ shipped (2026-07-20)

| # | Status |
|---|--------|
| **1.4.1-A** Detect Pilot + handoff helper (dashboard) | ☑ |
| **1.4.1-B** Post-generate toast + unbound code action | ☑ |
| **1.4.1-3** Setting + README + CHANGELOG + VSIX | ☑ |

Spec: `docs-internal/specs/pilot-handoff-v1.4.1.md` (local).

**Exit criteria:** con/sin Pilot acciones correctas; setting off silencia; Capa B fijos OK.

---

## Plan v1.4.0 — ✅ shipped (2026-07-15)

| # | Status |
|---|--------|
| **1.4.0-A** Rule `coach/dominant-then` + setting `max` | ✅ |
| **1.4.0-B** Rule `coach/redundant-tags` + Quick Fix | ✅ |
| **1.4.0-3** Wire + tests + CHANGELOG + VSIX | ✅ |

Spec: `docs-internal/specs/coach-rules-v1.4.0.md` (local).

**Exit criteria met:** dominant Then + redundant tags; Quick Fix tags; Coach toggle OK.

---

## Plan v1.3.0 — ✅ shipped (2026-07-15)

| # | Status |
|---|--------|
| **1.3.0-A** `listOrphanBindings` + tests | ✅ |
| **1.3.0-B** Diagnostics Information on binding files | ✅ |
| **1.3.0-3** Setting + VISUAL_LANGUAGE + README + VSIX | ✅ |

Spec: `docs-internal/specs/orphan-bindings-v1.3.0.md` (local).

**Exit criteria met:** orphan en Problems; setting off limpia; CodeLens “No usages” intacto.

---

## Plan v1.2.0 — ✅ shipped (2026-07-15)

| # | Status |
|---|--------|
| **1.2.0-A** Completion provider + keyword/prefix filter | ✅ |
| **1.2.0-B** Pattern humanize → insertText | ✅ |
| **1.2.0-3** README + CHANGELOG + VSIX | ✅ |

Spec: `docs-internal/specs/step-autocomplete-v1.2.0.md` (local).

**Exit criteria met:** IntelliSense desde índice en `binding-demo`; setting off silencia.

---

## Plan v1.1.0 — ✅ shipped (2026-07-12)

| # | Status |
|---|--------|
| **1.1.0-A** Copy binding snippet + copy pattern (clipboard) | ✅ |
| **1.1.0-B** Generate scaffold insert (C# + JS/TS) | ✅ |
| **1.1.0-3** README + CHANGELOG + VSIX | ✅ |

Spec: `docs-internal/specs/author-dx-v1.1.0.md` (local).

**Exit criteria met:** unbound step → copy + generate en `binding-demo` / `cucumber-demo`; reindex → bound.

---

## Plan v1.0.1 — ✅ shipped (2026-07-12)

| # | Status |
|---|--------|
| **1.0.1-A** Framework-aware hover (snippets + preview language) | ✅ |
| **1.0.1-B** Onboarding GIF + README embed | ✅ (embed; GIF manual pre-publish) |
| **1.0.1-3** CHANGELOG + VSIX | ✅ |

Spec: `docs-internal/specs/polish-v1.0.1.md` (local).

---

## Plan v0.9.1 — ✅ shipped (2026-07-06)

| # | Status |
|---|--------|
| **0.9.1-1** Diagnostic source `BDD Guardian` | ✅ |
| **0.9.1-2** i18n status labels + `showMatchScore` setting | ✅ |
| **0.9.1-3** README settings map + CHANGELOG | ✅ |
| **0.9.1-4** VSIX + Marketplace | ✅ |

Spec: `docs-internal/specs/bindings-ux-hygiene-v0.9.1.md` (local).

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
| P1 | ~~**Cucumber JS provider**~~ | ✅ v0.6.1 — `cucumber-demo` |
| P1 | Matching edge cases (optional) | `countCaptureGroups`, alternations — see BINDING_MATCHING.md |
| P2 | Ambiguous explicado | → **v1.6.1** spec `ambiguous-explained-v1.6.1.md` |
| P2 | ~~**Behave provider**~~ | ✅ v0.7.1 — `samples/behave-demo` |
| P2 | Coach: more rules + quick fixes | → **v1.4.0** spec `coach-rules-v1.4.0.md` |
| P2 | ~~**Godog provider**~~ | ✅ v0.7.0 |
| P3 | ~~Framework-aware hover (Track B)~~ | → **v1.0.1** spec `polish-v1.0.1.md` |
| P3 | Step autocomplete | → **v1.2.0** spec `step-autocomplete-v1.2.0.md` |
| P3 | ~~Copy as pattern code action~~ | → **v1.1.0** Track A ✅ |
| P3 | ~~Generate binding from unbound step~~ | → **v1.1.0** Track B ✅; Behave/Go/Java → **v1.5.0** spec `generate-stacks-v1.5.0.md` |
| P4 | Shared `@anghelll/bdd-gherkin-lite` with Pilot | v1.3+ — wait parsers stable |
| P4 | ~~Onboarding GIF / empty workspace hint~~ | Hint ✅ v1.0.0 · GIF → **v1.0.1** |
| P4 | `guardian-cli` | → **v1.6.0** spec `guardian-cli-v1.6.0.md` · T-D05 |
| P2 | ~~**Java Cucumber provider**~~ | ✅ v0.9.0 — `samples/java-cucumber-demo` |

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

## Plan v1.9.0 — ✅ shipped (2026-07-29)

| # | Status |
|---|--------|
| **1.9.0-A** `bddGuardian.ui.feedbackLevel` full/standard/minimal | ✅ |
| **1.9.0-B** Settings map docs (aliases code deferred) | ✅ |
| **1.9.0-3** Tests helper + CHANGELOG + VSIX | ✅ |

Spec: `docs-internal/specs/map-signal-clarity-v1.9.0.md` (local).  
**Después de** v1.8.0. North star: señal del mapa legible sin ruido.

**Exit criteria met:** default full sin regresión; minimal mantiene CodeLens+F12; Capa B OK.

---

## Plan v1.8.0 — ✅ shipped (2026-07-29)

| # | Status |
|---|--------|
| **1.8.0-A** CLI `resolve-step` + `coach-analyze` JSON | ✅ |
| **1.8.0-B** MCP stdio thin (discover/analyze/resolve/coach) | ✅ |
| **1.8.0-3** Docs CLI/MCP + CHANGELOG + VSIX | ✅ |

Spec: `docs-internal/specs/guardian-cli-mcp-v1.8.0.md` (local).  
**Después de** v1.7.0 tile. North star: mapa headless para agentes.

**Exit criteria met:** resolve-step bound en binding-demo; coach-analyze JSON; MCP documentado; Capa B OK.

---

*Last updated: 2026-09-04 — v1.15.0 Why unbound (GitHub; Marketplace pending publish).*
