# Changelog

All notable changes to the Reqnroll Navigator extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-02-13 (Beta)

### Added
- **Go to Definition**: F12 or Cmd+Click to navigate from step to binding
- **CodeLens**: Visual indicators above each step showing binding status
- **Diagnostics**: Warnings for unbound and ambiguous steps
- **Gutter Icons**: Visual indicators (✓ bound, ✗ unbound, ! ambiguous)
- **Navigation History**: Back/Forward navigation (Alt+←/→, Alt+H)
- **Enriched Hover**: Code preview, captured parameters, clickable links
- **Scenario Outline Support**: Examples table expansion for accurate matching
- **Multi-Provider Architecture**: Extensible for multiple BDD frameworks
  - C# Reqnroll (fully implemented)
  - Other providers (stubs for future)

### Notes
- Initial beta release for internal testing
- 65 unit tests passing
- Tested with GBM Automation project (684 steps, 404 bindings)

## [Unreleased]

### Planned
- Full implementation of additional language providers
- Step auto-completion
- Binding code generation from step text
