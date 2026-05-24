# BDD Guardian — guide for AI assistants

VS Code extension: navigate and validate BDD steps between `.feature` (Gherkin) and step definition bindings (Reqnroll, SpecFlow, planned Cucumber/Behave/Go).

## Commands

```bash
npm install
npm test          # compile + lint + vitest
npm run compile
npm run watch     # dev compile
```

Extension manual check: F5 (Extension Development Host), see `CONTRIBUTING.md`.

## Layer map

| Path | Responsibility |
|------|----------------|
| `src/core/` | Index, Gherkin/binding parsing, regex compile, resolver, scoring |
| `src/providers/bindings/` | Framework-specific providers |
| `src/features/` | CodeLens, hover, diagnostics, Coach, navigation |
| `docs/` | Start at `docs/README.md` — architecture, matching, providers, roadmap |

## Matching (most sensitive area)

Read `docs/BINDING_MATCHING.md` before changing matching behavior.

- Compile: `src/core/parsing/bindingRegex.ts`
- Step candidates: `src/core/matching/normalization.ts`
- Resolve: `src/core/matching/resolver.ts`, `scoring.ts`

Use Cursor skill **`@bdd-binding-matcher`** for matching tasks.

## Project Cursor setup

- **Rule:** `.cursor/rules/bdd-guardian.mdc` (always on in this repo)
- **Skill:** `.cursor/skills/bdd-binding-matcher/` (invoke explicitly while learning)

## Contributing

- Do not commit unless the user asks.
- Core changes require tests; UI strings need `en.json` + `es.json`.
- See `CONTRIBUTING.md` and `docs/PROVIDERS.md` for new providers.
