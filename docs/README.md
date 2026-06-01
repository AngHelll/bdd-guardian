# BDD Guardian — documentation

## Product direction

**Core:** navigate and validate BDD steps between Gherkin (`.feature`) and step-definition bindings.

**Shipped today:** C# Reqnroll and SpecFlow (full), Cucumber.js (JS/TS), binding usages CodeLens, diagnostics, decorations, Coach mode (incl. batch quick fixes), en/es UI, incremental index while editing.

**Next (see [ROADMAP.md](../ROADMAP.md)):** v0.7.0 Godog provider and detection report polish.

## Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, index, resolver, providers, VS Code features |
| [BINDING_MATCHING.md](./BINDING_MATCHING.md) | Regex compile, normalization, false unbound |
| [PROVIDERS.md](./PROVIDERS.md) | How to implement a binding provider |
| [ROADMAP.md](../ROADMAP.md) | Done vs planned work (single source for priorities) |

## Repo root

| File | Purpose |
|------|---------|
| [../README.md](../README.md) | User-facing overview, settings, known issues |
| [../CHANGELOG.md](../CHANGELOG.md) | Version history |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Dev setup, tests, PR process |
| [../ROADMAP.md](../ROADMAP.md) | Done vs planned work |
