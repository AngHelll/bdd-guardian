# Changelog

All notable changes to the BDD Guardian extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
