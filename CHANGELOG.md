# Changelog

All notable changes to the Reqnroll Navigator extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-13

### Added
- **Navigation History**: Back/Forward navigation between steps and bindings
  - `Alt+←` - Go back to previous location
  - `Alt+→` - Go forward to next location
  - `Alt+H` - Show navigation history picker
  - Status bar indicator showing current position in history
- **Scenario Outline Support**: Improved matching for steps with `<placeholders>`
  - Expands Examples table values for accurate binding resolution
  - Reduces false "No binding found" errors
- New configuration option `navigationHistorySize` (default: 50)

### Fixed
- CodeLens now correctly shows bindings for Scenario Outline steps
- Fixed duplicate CodeLens messages issue

## [2.0.0] - 2026-02-12

### Added
- **Multi-Provider Architecture**: Automatic detection of BDD frameworks
  - C# Reqnroll (fully implemented)
  - C# SpecFlow (stub)
  - JavaScript Cucumber (stub)
  - Java Cucumber (stub)
  - Python Behave/pytest-bdd (stub)
  - Go Godog (stub)
- **Provider Detection Report** command for debugging
- Comprehensive test suite with Vitest (65 tests)

### Changed
- Refactored core matching engine for better accuracy
- Improved regex pattern compilation with caching
- Enhanced CodeLens performance with lazy resolution

### Fixed
- Better handling of special characters in step patterns
- Improved whitespace normalization in matching

## [1.0.0] - 2026-02-01

### Added
- Initial release
- **Go to Definition**: F12 or Cmd+Click to navigate from step to binding
- **CodeLens**: Visual indicators above each step showing binding status
- **Diagnostics**: Warnings for unbound and ambiguous steps
- **Tag Filtering**: Filter steps by Gherkin tags (@P0, @smoke, etc.)
- **Decorations**: Visual highlighting for step states
- Configuration options for customization

## [Unreleased]

### Planned
- Phase 3: Gutter icons by binding state (✅ bound, ⚠️ ambiguous, ❌ unbound)
- Phase 4: Enriched hover with code preview and captured parameters
- Full implementation of additional language providers
