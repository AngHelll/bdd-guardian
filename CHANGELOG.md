# Changelog

All notable changes to the BDD Guardian extension will be documented in this file.

## [0.4.1] - 2025-02-14

**Highlights:** README "What's improved" section; test badge (140).

### Changed
- **Documentation**: README "What's improved" section; test count badge updated to 140.

## [0.4.0] - 2025-02-14

**Highlights:** C# verbatim patterns with quotes now match correctly; single architecture (IndexManager + providers); unified Gherkin parser; UI language (en/es).

### Changed
- **Branding**: All user-facing text and logs now use "BDD Guardian" (replacing "Reqnroll Navigator")
- **Single Gherkin parser**: Coach mode now uses the core Gherkin parser; duplicate coach parser removed. One source of truth for .feature parsing.
- **Documentation**: Added `src/providers/README.md` explaining editor providers vs binding providers
- **Architecture**: Removed legacy binding path (BindingIndexer, StepMatcher, old providers). Single flow: IndexManager + binding providers + core resolver. Reduced duplication and one regex compiler in core.

### Fixed
- Diagnostic source in Problems panel shows "BDD Guardian"
- Output channel and status messages show consistent extension name
- **C# verbatim patterns with quotes**: Patterns like `[When(@"they click on ""(.*)"" in the menu")]` now match steps such as `When they click on "Projects" in the menu`. The attribute regex now allows `""` inside verbatim strings (C# grammar).

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

## [Unreleased]

### Planned
- JavaScript Cucumber support
- Python Behave/pytest-bdd support
- Go Godog support
- Step auto-completion
- Binding code generation from step text

## [0.3.0] - 2025-06-14

### Added - Testing Infrastructure
- **Expanded Test Suite**: 109 tests (44 new tests added)
  - `scoring.test.ts`: Deterministic scoring, specificity scoring, GBM-style pattern tests
  - `ambiguity.test.ts`: Overlapping pattern detection, best match selection, edge cases
  - `parsing.test.ts`: Gherkin parsing, C# binding extraction, pattern compilation
- **GBM-style Fixtures**: Real-world test fixtures from production environments
  - `gbm-ppr.feature`: PPR portfolio projection scenarios
  - `GbmPprSteps.cs`: Matching C# step bindings
- **Coverage Reporting**: v8 coverage integration with Vitest

### Changed
- Test coverage for core modules:
  - `bindingRegex.ts`: 100% coverage
  - `scoring.ts`: 94.73% coverage
  - `resolver.ts`: 90% coverage
