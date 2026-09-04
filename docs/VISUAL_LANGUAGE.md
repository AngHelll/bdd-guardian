# BDD Guardian — Visual language

Single reference for how step binding status appears across the extension.

**Principle:** same semantics everywhere; density varies by surface (gutter = scan, CodeLens = action, hover = detail).

## Suite (ForgeOne)

| Extension | Role |
|-----------|------|
| **BDD Guardian** | Navigation & binding map (this extension) |
| **BDD Pilot** | Test execution |

**Marketplace tile (v1.7.0+):** ForgeOne Opción B — navy gradient (`#1a2332` → `#0d1219`), cool light glyph (`#e8eef6`), silhouette in `media/guardian.svg` / `media/icon-marketplace.svg`. `galleryBanner.color` = `#1a2332`. Gutter / `charts.*` status colors stay as below (unchanged).

## Status semantics

| Status | Meaning |
|--------|---------|
| **Bound** | Exactly one binding matches (or policy resolved to one). |
| **Unbound** | No binding matches this step. |
| **Ambiguous** | Two or more bindings match (Reqnroll-like default). Hover/Problems explain *why* (v1.6.1+). |
| **Orphan** | Binding exists but no feature step resolves to it (unused). |
| **Indexing** | Workspace index not ready yet. |

## By surface

| Surface | Bound | Unbound | Ambiguous | Orphan | Indexing |
|---------|-------|---------|-----------|--------|----------|
| **Gutter** (`resources/icons/*.svg`) | Green circle + check | Red circle + X | Orange circle + ! | — | (no gutter icon) |
| **CodeLens** (feature) | `$(check)` + `Class.Method` | `$(error)` + message | `$(warning)` + candidates | — | `$(warning)` reindex CTA |
| **CodeLens** (binding file) | usage count | — | — | “No usages” (existing) | — |
| **Hover** | ✅ emoji + details | ❌ emoji + suggestion | ⚠️ emoji + why + top matches | — | ⏳ emoji |
| **Problems** | — | Diagnostic **Warning** (step) | Diagnostic **Information** + why hint (step) | Diagnostic **Information** (binding) | — |
| **Suite map (Explorer)** | count in summary only | Group + jump + Generate/Copy | Group + jump + Explain | Group + jump to binding | “Indexing…” |
| **Border / ruler** | `charts.green` | `charts.red` | `charts.yellow` | — | — |

Implementation: `src/ui/stepStatus.ts` (`getCodeLensIcon`, `getStatusColor`, `getStatusLabel`, `getStatusEmoji`).

## Gutter icons

Custom SVGs under `resources/icons/` use **fixed colors** for legibility at 16px. Border and overview ruler use VS Code theme colors (`charts.green`, `charts.red`, `charts.yellow`).

Toggle: `bddGuardian.gutterIcons.enabled`.

## CodeLens icons

CodeLens uses VS Code **codicons** aligned with gutter meaning (check / error / warning), not the SVG glyphs.

Optional debug score: `bddGuardian.ui.showMatchScore` (default `false`).

**Feedback level (v1.9.0+):** `bddGuardian.ui.feedbackLevel` sets a **ceiling** for visual channels:

| Value | Gutter | Border / ruler | Problems (steps) | CodeLens |
|-------|--------|----------------|------------------|----------|
| `full` (default) | ✓ | ✓ | ✓ | ✓ |
| `standard` | ✓ | — | ✓ | ✓ |
| `minimal` | — | — | — | ✓ |

Granular toggles (`gutterIcons.enabled`, `reqnrollNavigator.enableDecorations` / `enableDiagnostics` / `enableCodeLens`) can still turn a channel **off** under that ceiling.

**Suite map (v1.12.0+):** Explorer **BDD Map** lists workspace holes (unbound / ambiguous / orphan) with the same status semantics. It is **not** gated by `feedbackLevel`. Toggle: `bddGuardian.suiteMap.enabled`. **v1.13.0+:** holes nested by file; unbound leaves offer Generate/Copy (same author commands as the lightbulb). **v1.14.0+:** ambiguous leaves offer Explain (same why as hover + QuickPick of colliding bindings). **v1.15.0+:** unbound leaves also offer Explain (why + QuickPick of scoped-out bindings when that is the reason); Generate/Copy stay.

## Hover emojis

Markdown hovers intentionally use emojis (native, readable in VS Code hovers). Labels use i18n (`hoverBound`, etc.).

**Unbound snippets** follow the workspace **primary detected provider** (or binding file extension when bound preview applies): C# attribute, Cucumber.js `Given()`, Behave `@given`, Java `@Given`, Godog `ctx.Given` — see `src/features/hovers/bindingSnippets.ts`.

## Diagnostics source

Binding step diagnostics and orphan bindings: **`BDD Guardian`** (`bddGuardian/unbound-step`, `bddGuardian/orphan-binding`). Coach findings: **`BDD Coach`**.

## Settings

| Setting | Effect |
|---------|--------|
| `bddGuardian.gutterIcons.enabled` | Gutter SVG icons |
| `reqnrollNavigator.enableDecorations` | Left border + overview ruler |
| `reqnrollNavigator.enableCodeLens` | CodeLens above steps |
| `bddGuardian.hoverDetails.enabled` | Rich hover |
| `bddGuardian.displayLanguage` | EN/ES labels |
| `bddGuardian.orphanBindings.enabled` | Unused binding Problems (Information) |
| `bddGuardian.suiteMap.enabled` | Explorer BDD Map (workspace holes) |

See [README.md](../README.md) settings map for legacy vs branding keys.
