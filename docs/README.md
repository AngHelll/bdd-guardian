# BDD Guardian — documentation

## Product direction

**Core:** navigate and validate BDD steps between Gherkin (`.feature`) and step-definition bindings.

**Shipped today:** C# Reqnroll and SpecFlow (full), binding usages CodeLens, diagnostics, decorations, Coach mode, en/es UI, incremental index while editing.

**Next (see [ROADMAP.md](./ROADMAP.md)):** non-C# providers (Cucumber JS first), Find All References, Coach rules/quick fixes, step autocomplete.

## Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, index, resolver, providers, VS Code features |
| [BINDING_MATCHING.md](./BINDING_MATCHING.md) | Regex compile, normalization, false unbound |
| [PROVIDERS.md](./PROVIDERS.md) | How to implement a binding provider |
| [ROADMAP.md](./ROADMAP.md) | Done vs planned work (single source for priorities) |

## Repo root

| File | Purpose |
|------|---------|
| [../README.md](../README.md) | User-facing overview, settings, known issues |
| [../CHANGELOG.md](../CHANGELOG.md) | Version history |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Dev setup, tests, PR process |
| [../AGENTS.md](../AGENTS.md) | Short guide for AI assistants in this repo |
