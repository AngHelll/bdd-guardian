# Changelog

All notable changes to the Reqnroll Navigator extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2025-02-13

### Added
- **Enriched Hover Provider**: Comprehensive hover information on steps
  - Code preview of the binding method implementation
  - Captured parameters table showing what the regex extracts
  - Clickable navigation links (Peek Definition, Go to File)
  - Examples table context for Scenario Outline steps
  - Suggested binding patterns for unbound steps
  - Caching for performance (30 second TTL)
- Support for And/But keyword resolution using context

### Changed
- Hover content now uses VS Code Markdown with proper formatting
- Improved parameter extraction using binding regex

## [2.2.0] - 2025-02-13

### Added
- **Gutter Icons**: Visual indicators in the editor gutter
  - Green checkmark (✓) for bound steps
  - Red X (✗) for unbound steps  
  - Orange warning (!) for ambiguous steps
- Custom SVG icons in `resources/icons/`
- New extension icon

### Changed
- Updated decoration provider to use gutter icons
- Improved visual feedback for step binding states

## [2.1.0] - 2025-02-13

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

## [2.0.0] - 2025-02-12

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

## [1.0.0] - 2025-02-01

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
- Full implementation of additional language providers (SpecFlow, Cucumber, Behave, Godog)
- Step auto-completion
- Binding code generation from step text
