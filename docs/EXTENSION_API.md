# BDD Guardian — Extension API

BDD Guardian exposes a **read-only Index API v1** via `extension.exports` for companion extensions (e.g. BDD Jarvis).

## Activation

```typescript
const ext = vscode.extensions.getExtension('anghelll.bdd-guardian');
await ext?.activate();
const api = ext?.exports as GuardianIndexApiV1 | undefined;
```

## GuardianIndexApiV1

| Member | Description |
|--------|-------------|
| `apiVersion` | Always `1` |
| `isReady` | `true` when indexing finished, workspace has features, and `lastIndexed > 0` |
| `getSnapshot()` | Deep-copied DTO or `null` when not ready |
| `onDidChangeIndex(listener)` | Fires when the workspace index changes (same event as internal index) |
| `resolveStep(featurePath, line)` | **v1.1** (v0.8.3+) — `bound` / `unbound` / `ambiguous` for a 0-based line; `null` if not ready or no step |

## Security

- In-process only (`extension.exports`) — no network surface
- Read-only — no reindex or mutation methods
- Snapshots are deep-copied JSON-safe DTOs (paths as strings, no secrets)

## DTO overview

`GuardianIndexSnapshotDto` includes:

- `indexedAt`, `stats` (features, scenarios, steps, tags, bindings)
- `features[]` — paths, names, tags, scenario summaries
- `bindings[]` — patterns, keywords, provider id, class/method
- `providers[]` — active binding providers with counts
- `tags[]` — optional rollup

See `src/api/types.ts` for the canonical TypeScript definitions.

## Ecosystem (ForgeOne)

| Extension | Role |
|-----------|------|
| **BDD Guardian** (this) | Index, bindings, navigation — **API producer** since v0.8.2 |
| **BDD Jarvis** | Workspace analysis, quality insights — **primary consumer** since v0.2.1 |
| **BDD Pilot** | Test execution |

Jarvis activates Guardian by id `anghelll.bdd-guardian`, polls `isReady`, and maps `getSnapshot()` into its analysis report. Workspaces with features but no step definitions (e.g. Gherkin-only samples) may show `bindings: 0` even when `source: guardian` — that is expected.

Internal implementation notes: `docs-internal/specs/guardian-index-api-v0.8.2.md`.

## Consumer checklist (Jarvis)

1. Activate Guardian by exact id `anghelll.bdd-guardian`
2. Type-guard `apiVersion === 1` and required methods
3. Poll `isReady` up to ~10s before falling back to jarvis-basic
4. Subscribe to `onDidChangeIndex` with ≥500ms debounce if caching analysis sessions
