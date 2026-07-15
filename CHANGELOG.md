# Changelog

All notable changes to the BDD Guardian extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.4.0] - 2026-07-15

**Highlights:** Coach rules oleada — dominant Then + redundant Feature→Scenario tags.

### Added

- **`coach/dominant-then`** — warn on missing Then or more than `bddGuardian.coach.dominantThen.max` (default 1)
- **`coach/redundant-tags`** — info when Scenario repeats a Feature tag; Quick Fix removes the tag
- Vitest coverage in `coach.test.ts`

### Changed

- README Coach section lists the two new rules

## [1.3.0] - 2026-07-15

**Highlights:** Orphan / unused binding diagnostics — mapa 360° (feature unbound + binding unused).

### Added

- **`listOrphanBindings`** — pure detection via `findReferencesForBinding`
- **Problems** Information diagnostics on binding files (`bddGuardian/orphan-binding`)
- **`bddGuardian.orphanBindings.enabled`** — master toggle (default `true`)
- Vitest: `orphanBindings.test.ts`
- `docs/VISUAL_LANGUAGE.md` — Orphan status row

### Changed

- README: Orphan bindings section under Configuration

## [1.2.0] - 2026-07-15

**Highlights:** Step autocomplete from indexed bindings while typing in `.feature` files.

### Added

- **Completion provider** on `gherkin` / `feature` — suggestions from workspace bindings (keyword + prefix)
- **`bddGuardian.autocomplete.enabled`** — master toggle (default `true`)
- Pure helpers: `humanizePatternForCompletion`, `filterBindingsForCompletion` (`src/core/autocomplete/`)
- Vitest: `stepCompletion.test.ts`

### Changed

- README: **Autocomplete** section under Configuration

## [1.1.0] - 2026-07-12

**Highlights:** Author DX — copy binding snippets from unbound steps and generate scaffolds (C# / JS/TS).

### Added

- **Code actions** on unbound steps: copy binding snippet, copy suggested pattern, generate binding (insert)
- **`bddGuardian.authorActions.enabled`** — master toggle for author quick fixes
- **`scaffoldInsert.ts`** — pure insert logic for C# `[Binding]` classes and Cucumber.js append
- Diagnostic code `bddGuardian/unbound-step` for robust quick-fix filtering
- Vitest: `scaffoldInsert.test.ts`, `bindingCodeActions.test.ts`

### Changed

- README: **Author actions** section under Configuration

## [1.0.1] - 2026-07-12

**Highlights:** Framework-aware hover snippets and preview fences; zero-bindings hover shows detected stack.

### Added

- **`bindingSnippets.ts`** — unbound binding templates per provider (C#, JS, Java, Python, Go)
- i18n: `hoverSuggestedForFramework`, `hoverDetectedFramework`, `hoverShowDetectionReport`
- Vitest: `bindingSnippets.test.ts`
- README embed for `docs/assets/guardian-onboarding.gif` (record manually)

### Changed

- Hover **unbound** suggests snippet for primary detected framework (not always C#)
- Hover **bound** code preview uses correct fence language (`.ts` → typescript, etc.)
- Zero-bindings hover links to provider detection report when stack is detected

## [1.0.0] - 2026-07-09

**Highlights:** Stable public release — communication polish, visual language, marketplace onboarding hint.

### Added

- **`bddGuardian.onboarding.enabled`** — one-time hint when `.feature` files exist but no bindings are indexed
- **`docs/VISUAL_LANGUAGE.md`** — status semantics across gutter, CodeLens, hover, Problems
- i18n: navigation status bar, Coach quick-fix labels, onboarding toast (EN/ES)
- Vitest: `zeroBindingsHint.test.ts`; extended `stepStatus.test.ts` (`getCodeLensIcon`)

### Changed

- **Spanish glossary** — unified *Enlazado* / *Sin enlazar* / *Ambiguo* for all status labels
- **CodeLens icons** — `$(check)` bound, `$(error)` unbound, `$(warning)` ambiguous (aligned with gutter)
- **Marketplace** — description and keywords list all five framework stacks
- **README** — v1.0.0, corrected CodeLens legend, quick demo section, settings map
- Removed legacy `icon_placeholder.svg` (Reqnroll Navigator)

### Notes

- Record `docs/assets/guardian-onboarding.gif` manually for README/Marketplace (see `docs/assets/README.md`)

## [0.9.1] - 2026-07-06

**Highlights:** Bindings **UX hygiene** — consistent BDD Guardian branding in Problems, i18n status labels, optional CodeLens match score.

### Added

- **`bddGuardian.ui.showMatchScore`** — default `false`; hide numeric score in bound CodeLens titles
- i18n keys `statusBound`, `statusUnbound`, `statusAmbiguous`, `statusIndexingLabel` (EN/ES)
- Vitest: `stepStatus.test.ts`

### Changed

- Binding diagnostics collection and `Diagnostic.source` → **`BDD Guardian`** (was `reqnroll-navigator`)
- `getStatusLabel()` and gutter decoration hovers use localized status labels
- README **Settings map** — `bddGuardian.*` vs legacy `reqnrollNavigator.*`

## [0.9.0] - 2026-06-11

**Highlights:** **Java Cucumber-JVM provider** — fifth complete binding provider (Maven/Gradle detect + `@Given`/`@When`/`@Then` indexing).

### Added

- **`javaCucumberBindingParser`** — parse Cucumber-JVM annotations (`io.cucumber.java` + legacy `cucumber.api.java`)
- **`JavaCucumberProvider`** — detect `io.cucumber` in `pom.xml` / `build.gradle(.kts)`; narrowed binding globs
- **`samples/java-cucumber-demo`** — Capa B Maven sample
- Vitest: `javaCucumberBindingParser.test.ts`, `javaCucumberProvider.test.ts`, `java-cucumber-demo.test.ts`

## [0.8.3] - 2026-06-11

**Highlights:** Index API **v1.1** — `resolveStep(featurePath, line)` for bound / unbound / ambiguous status (BDD Jarvis v0.2.2 consumer).

### Added

- **`resolveStep`** on `GuardianIndexApiV1` — serializable `GuardianStepResolveDto`
- `src/api/stepResolve.ts` — reuses Guardian resolver (same as CodeLens)
- Vitest: `stepResolve.test.ts` (binding-demo corpus)

## [0.8.2] - 2026-06-09

**Highlights:** **Index API v1** — read-only `extension.exports` surface for companion extensions (BDD Jarvis).

### Added

- **`src/api/`** — `GuardianIndexApiV1`, snapshot mapper, `createGuardianIndexApi`
- `activate()` returns API via `extension.exports` (`isReady`, `getSnapshot`, `onDidChangeIndex`)
- `docs/EXTENSION_API.md` — consumer documentation
- Vitest: `indexApiMapper.test.ts`

## [0.7.2] - 2026-06-02

**Highlights:** Optional **mono-provider indexing** — index only the primary detected framework when you do not need every active provider in the workspace.

### Added

- **`bddGuardian.providers.indexMode`** — `all` (default) or `primary` (index only highest-confidence provider)
- **`providerIndexing.ts`** — resolves which providers to index; Vitest coverage

### Changed

- **Output channel** and **Provider Detection Report** show the active indexing mode
- Changing `indexMode` triggers a full reindex

## [0.7.1] - 2026-06-02

**Highlights:** Fourth binding provider — **Python Behave** — for `.feature` ↔ `features/steps/*.py` navigation.

### Added

- **Behave provider (Python)** — detects `behave` in `requirements.txt` / `pyproject.toml` / `behave.ini`; indexes `@given` / `@when` / `@then` string patterns
- **`pythonBehaveBindingParser.ts`** — static parser + Vitest coverage
- **`samples/behave-demo`** — Capa B workspace for Python navigation

## [0.7.0] - 2026-06-01

**Highlights:** Third binding provider — **Go Godog** — plus clearer provider detection output after indexing.

### Added

- **Godog provider (Go)** — detects `github.com/cucumber/godog` in `go.mod` / imports; indexes `ctx.Given`/`When`/`Then`/`Step` with backtick regex patterns
- **`goGodogBindingParser.ts`** — static parser + Vitest coverage
- **`samples/godog-demo`** — Capa B workspace for Go navigation

### Changed

- **Full reindex** invalidates provider detection cache (fresh detect on Reindex)
- **Output channel** — provider detection summary (ACTIVE / inactive, confidence, primary reason)
- Actionable hint when no providers are active

## [0.6.2] - 2026-06-01

**Highlights:** Coach batch quick fixes, Cucumber.js indexing fixes, and clearer UX when bindings are missing.

### Added

- **Coach batch quick fix** — CodeAction “Apply Coach quick fixes (file)” for deterministic fixes (MVP: `coach/outline-examples` inserts `Examples:` template)
- **`quickFixBatch.ts`** — pure helper + Vitest coverage
- **`bindingGlob.ts`** — split top-level brace alternates for reliable `findFiles`

### Changed

- **`js-cucumber` binding glob** — narrower paths under `features/` and `*.{steps,step,definitions}.*`
- **Binding file watchers** — watch globs from all active providers (not only `**/*.cs`)
- **Incremental binding index** — picks provider by file extension (e.g. `.ts` → JS Cucumber)

### Fixed

- **Cucumber.js workspaces** — `findFiles` failed on nested `{…}` binding globs → 0 bindings indexed in `cucumber-demo`
- **Hover** — no longer shows perpetual “Indexing…” when index finished with zero bindings
- **CodeLens reindex** — uses `reqnrollNavigator.reindex` (broken command id removed)

## [0.6.1] - 2026-05-31

**Highlights:** First non-C# provider — Cucumber.js (JS/TS) step definition navigation and matching.

### Added

- **Cucumber.js provider (JS/TS)** — detects `@cucumber/cucumber` and indexes step definitions
- **JS binding parser (MVP)** — `Given/When/Then('string')`, `` `template` ``, and `/regex/` patterns
- **JS sample workspace** — `samples/cucumber-demo` for Capa B
- Vitest coverage for provider detect + parsing

### Changed

- Parsing exports include JS Cucumber parser entry point

## [0.6.0] - 2026-05-31

**Highlights:** Wave A precision foundation — Cucumber Expressions (`{int}`, `{string}`, …) + `[StepDefinition]` support for Reqnroll and future Cucumber JS.

### Added

- **Cucumber Expressions compiler (MVP)** — compile `{int}`, `{float|double}`, `{word}`, `{string}` to strict full-line regex
- **`[StepDefinition]` support** — indexes StepDefinition bindings as Given/When/Then (Reqnroll)
- **`ExpressionType = ...` override** — forces CucumberExpression vs RegularExpression compile path when present
- `samples/binding-demo` scenarios `@v060` to dogfood Cucumber Expressions + StepDefinition

### Changed

- Binding attribute regex now supports `StepDefinition` and ignores extra args after the first string literal
- Binding identity includes keyword (prevents StepDefinition dedupe collisions)
- Test suite expanded (Wave A coverage)

## [0.5.1] - 2026-05-31

**Highlights:** Matching patch — 0 skipped tests, CodeLens resolve from disk when `.feature` tab is closed, SpecFlow detect regression tests.

### Added

- **`getStepAtPositionFromContent`** — resolve outline candidates from on-disk `.feature` text (CodeLens closed-tab path)
- **SpecFlow detect tests** — confidence 0 when workspace uses Reqnroll (`using` or NuGet)

### Changed

- **CodeLens resolve** — reads `.feature` from disk before literal fallback when editor tab is closed
- Test suite: **177 tests** (0 skipped)

### Fixed

- Precision corpus **portfolio alternation** test enabled (outline + `(debt|balance|…)` regex already matched post v0.5.0)

## [0.5.0] - 2026-05-31

**Highlights:** Binding alignment (SRBA) — Reqnroll/SpecFlow shared C# parser, Reqnroll-like ambiguity policy, Scenario Outline precision corpus, Examples-after-steps refresh.

### Added

- **Shared C# binding parser** (`core/parsing/csharpBindingParser.ts`) — Reqnroll and SpecFlow providers delegate to the same attribute/regex extraction
- **SpecFlow provider** — indexes SpecFlow-only projects (NuGet / `TechTalk.SpecFlow` detection); same navigation as Reqnroll
- **Precision corpus** — `matching-corpus.feature` + `MatchingCorpusSteps.cs` regression suite (`precision-corpus.test.ts`)
- **Ambiguity policy (default)** — when ≥2 bindings match, status is `ambiguous` (aligned with Reqnroll runtime / BDD Pilot `AMBIGUOUS_STEPS`)
- Setting **`bddGuardian.matching.preferSpecificBinding`** (default `false`) — legacy score-based winner when `true`
- **Scenario Outline** — Examples tables on plain `Scenario` (not only `Scenario Outline`); candidate refresh when Examples appear after steps

### Changed

- README and docs: **C# bindings — Reqnroll & SpecFlow use the same model**; Guardian navigates, [BDD Pilot](https://github.com/AngHelll/bdd-pilot) executes
- Test suite: **164 tests** (1 skipped: portfolio alternation follow-up v0.5.1)

### Fixed

- False “bound” when overlapping patterns (`\d+` vs `.*`) — now ambiguous unless `preferSpecificBinding` is enabled
- Outline steps with Examples after steps no longer stay unbound in the editor

## [0.4.2] - 2026-05-24

**Highlights:** Find All References (Shift+F12), live index while editing, pattern whitespace matching, docs and Cursor agent setup.

### Added

- **Find All References (Shift+F12)** on `.feature` steps and binding files — shared `core/references` logic with binding usage CodeLens
- `docs/BINDING_MATCHING.md` — how step-to-binding regex matching works
- `docs/README.md` — documentation index and product direction
- Cursor setup: `AGENTS.md`, `.cursor/rules/bdd-guardian.mdc`, `@bdd-binding-matcher` skill

### Fixed

- **Pattern whitespace:** binding patterns normalized like step text (fewer false “unbound”)
- **Index while editing:** `.feature` files reindex from the open editor buffer (debounced); bindings replaced per file on incremental update (no duplicate bindings after `.cs` saves)
- **Coach duplicate steps:** one diagnostic when the same text appears 3+ times (no overlapping per-scenario + global findings)
- **Coach language:** analyzes documents with `gherkin` or `feature` language ID (not only `feature`)

### Changed

- Binding CodeLens uses indexed bindings per file (works without `bindingFiles` map entries)
- README, ROADMAP, ARCHITECTURE, and CONTRIBUTING aligned with current behavior
- Test suite: 147 tests

## [0.4.1] - 2025-02-14

**Highlights:** README "What's improved" section; test badge (140).

### Changed

- **Documentation**: README "What's improved" section; test count badge updated to 140.

## [0.4.0] - 2025-02-14

**Highlights:** C# verbatim patterns with quotes now match correctly; single architecture (IndexManager + providers); unified Gherkin parser; UI language (en/es).

### Changed

- **Branding**: All user-facing text and logs now use "BDD Guardian" (replacing "Reqnroll Navigator")
- **Single Gherkin parser**: Coach mode now uses the core Gherkin parser; duplicate coach parser removed. One source of truth for `.feature` parsing.
- **Documentation**: Added `src/providers/README.md` explaining editor providers vs binding providers
- **Architecture**: Removed legacy binding path (BindingIndexer, StepMatcher, old providers). Single flow: IndexManager + binding providers + core resolver. Reduced duplication and one regex compiler in core.

### Fixed

- Diagnostic source in Problems panel shows "BDD Guardian"
- Output channel and status messages show consistent extension name
- **C# verbatim patterns with quotes**: Patterns like `[When(@"they click on ""(.*)"" in the menu")]` now match steps such as `When they click on "Projects" in the menu`. The attribute regex now allows `""` inside verbatim strings (C# grammar).

## [0.3.0] - 2025-06-14

### Added - Testing Infrastructure

- **Expanded Test Suite**: 109 tests (44 new tests added)
  - `scoring.test.ts`: Deterministic scoring, specificity scoring, matching-corpus pattern tests
  - `ambiguity.test.ts`: Overlapping pattern detection, best match selection, edge cases
  - `parsing.test.ts`: Gherkin parsing, C# binding extraction, pattern compilation
- **Matching corpus fixtures**: Synthetic multi-scenario fixtures for precision regression
  - `matching-corpus.feature`: Outlines, quotes, alternations, ambiguous pairs
  - `MatchingCorpusSteps.cs`: Matching C# step bindings
- **Coverage Reporting**: v8 coverage integration with Vitest

### Changed

- Test coverage for core modules:
  - `bindingRegex.ts`: 100% coverage
  - `scoring.ts`: 94.73% coverage
  - `resolver.ts`: 90% coverage

## [0.2.0] - 2025-02-13 (Alpha)

### Added

- **UI State Module**: Centralized `ui/stepStatus.ts` for consistent status handling
- **New Settings**:
  - `bddGuardian.gutterIcons.enabled` - Toggle gutter icons
  - `bddGuardian.hoverDetails.enabled` - Toggle enriched hover

### Changed

- **Decorations**: Now debounced (200ms) to avoid blocking typing
- **Hover Provider**: Cleaner design with collapsible code preview
- **QuickPick**: Shows "Best match" label for top candidate
- **Performance**: Decorations only update for active editor

### Improved

- Visual feedback is now subtle and native to VS Code
- All visual features are configurable
- Better separation of concerns with UI module

## [0.1.0] - 2025-02-13 (Alpha)

### Added

- **Go to Definition**: F12 or Cmd+Click to navigate from step to binding
- **CodeLens**: Visual indicators above each step showing binding status
- **Diagnostics**: Warnings for unbound and ambiguous steps
- **Gutter Icons**: Visual indicators (✓ bound, ✗ unbound, ! ambiguous)
- **Navigation History**: Back/Forward navigation (Alt+←/→, Alt+H)
- **Enriched Hover**: Code preview, captured parameters, clickable links
- **Scenario Outline Support**: Examples table expansion for accurate matching
- **Multi-Framework Architecture**: Extensible for multiple BDD frameworks
  - C# Reqnroll (fully implemented)
  - C# SpecFlow (fully implemented)

### Notes

- Initial alpha release for testing
- 65 unit tests passing

### Planned (moved to [Unreleased] / ROADMAP)

- JavaScript Cucumber, Python Behave/pytest-bdd, Go Godog
- Step auto-completion
- Binding code generation from step text
