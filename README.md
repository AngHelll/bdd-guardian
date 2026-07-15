# BDD Guardian 🛡️

> Guard and navigate your BDD steps across Reqnroll, SpecFlow, Cucumber, Godog, Behave, and Java!

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=anghelll-bdd-guardian.bdd-guardian)
[![Tests](https://img.shields.io/badge/tests-229%20passing-brightgreen.svg)](https://github.com/AngHelll/bdd-guardian)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![CI](https://github.com/AngHelll/bdd-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/AngHelll/bdd-guardian/actions)

## 🖥️ Compatibility

| Requirement | Supported |
|-------------|-----------|
| **VS Code** | >= 1.85.0 |
| **Windows** | ✅ |
| **macOS** | ✅ |
| **Linux** | ✅ |
| **Remote - SSH** | ✅ |
| **Dev Containers** | ✅ |
| **Codespaces** | ✅ |

A VS Code extension that provides intelligent navigation, visual feedback, and diagnostics for BDD projects across five binding stacks.

### ✨ What's new (1.0.0)

- **Stable multi-framework release** — C# (Reqnroll/SpecFlow), JavaScript Cucumber.js, Go Godog, Python Behave, Java Cucumber-JVM.
- **Communication polish** — Unified Spanish status labels (*Enlazado* / *Sin enlazar*); i18n for navigation and Coach UI.
- **Visual language** — CodeLens icons aligned with gutter semantics; see [docs/VISUAL_LANGUAGE.md](docs/VISUAL_LANGUAGE.md).
- **First-run hint** — One-time toast when `.feature` files exist but no bindings are indexed (`bddGuardian.onboarding.enabled`).
- **Guardian ↔ Pilot** — Navigate bindings here; run tests with [BDD Pilot](https://github.com/AngHelll/bdd-pilot). [BDD Jarvis](https://github.com/AngHelll/bdd-jarvis) consumes the Index API for automation.

### 🎬 Quick demo

Open [`samples/binding-demo/`](./samples/binding-demo/) after installing the VSIX: wait for **Ready** in the status bar → CodeLens above a step → **Go to Definition** to the binding.

![Quick demo — binding-demo: CodeLens and Go to Definition](docs/assets/guardian-onboarding.gif)

> Maintainer: if the GIF is missing locally, record per [docs/assets/README.md](docs/assets/README.md) before Marketplace publish.

### ✨ Highlights (0.5.x–0.9.x)

- **Reqnroll & SpecFlow — same binding engine** — Shared C# parser; SpecFlow-only projects index and navigate like Reqnroll. Reqnroll is the current open-source line; SpecFlow projects keep the same UX.
- **Ambiguity aligned with runtime** — When multiple bindings match, Guardian shows ⚠️ ambiguous (Reqnroll-like), not a silent “best score” bound. Optional `bddGuardian.matching.preferSpecificBinding` restores legacy behavior.
- **Scenario Outline precision** — Examples on plain `Scenario`; expanded candidates from table rows; matching-corpus regression suite.
- **Guardian ↔ Pilot workflow** — Navigate and validate bindings here; run tests with [BDD Pilot](https://github.com/AngHelll/bdd-pilot). If Pilot reports `PENDING_STEPS` or `AMBIGUOUS_STEPS`, refine bindings and re-check in Guardian.
- **164 tests** — Includes precision corpus and SpecFlow provider coverage.

### ✨ What's improved (0.4.x)

- **C# verbatim patterns with quotes** — Bindings like `[When(@"they click on ""(.*)"" in the menu")]` now correctly match steps such as `When they click on "Projects" in the menu`.
- **Pattern whitespace** — Binding patterns are normalized like step text (fewer false “unbound”). See [docs/BINDING_MATCHING.md](docs/BINDING_MATCHING.md).
- **Index while you edit** — Open `.feature` files reindex from the editor buffer (debounced); binding files replace per-file entries on save (no duplicate index entries).
- **Single architecture** — One indexing and resolution path (IndexManager + binding providers + core resolver); one regex compiler in core.
- **Unified Gherkin parsing** — Coach and navigation/diagnostics share the same core parser for `.feature` files.
- **UI language** — Optional English/Spanish via `bddGuardian.displayLanguage`.
- **197 tests** — Matching, parsing, index, references, Coach, and multi-provider coverage.

### 📊 CodeLens
See binding status directly above each step:
- ✅ **Bound**: Shows `ClassName.MethodName` — click to navigate
- ❌ **Unbound**: No binding found
- ⚠️ **Ambiguous**: Multiple bindings match — click to select

### 🎯 Visual Feedback

BDD Guardian provides subtle, non-intrusive visual feedback:

#### Gutter Icons
Small icons in the editor gutter show step status at a glance:
- ✓ Green checkmark — bound step
- ✗ Red X — unbound step
- ! Orange warning — ambiguous step

#### Left Border
A subtle colored border on step lines reinforces status.

#### Overview Ruler
Status markers appear in the minimap/overview ruler for quick file scanning.

> 💡 **Tip**: All visual feedback can be disabled via settings.

### 💬 Enriched Hover

Hover over any step for detailed information:

**For Bound steps:**
- Binding class and method
- Regex pattern
- File location (clickable)
- Captured parameters
- Code preview (expandable)

**For Unbound steps:**
- Suggested binding pattern

**For Ambiguous steps:**
- Top 3 matching bindings
- Best match highlighted
- Link to show all matches

### 🔎 Find All References (Shift+F12)

| From | Shows |
|------|--------|
| **Step** in a `.feature` | Other steps with the same text or the same binding match (all indexed features) |
| **Binding** in `.cs` (etc.) | The binding line + every `.feature` step that resolves to it |

Same resolver and index as CodeLens and Go to Definition — not generated Reqnroll code under `obj/`.

### 🧭 Navigation History
Navigate back and forward between steps and bindings:

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Alt+←` | Go Back | Return to previous location |
| `Alt+→` | Go Forward | Go to next location |
| `Alt+H` | Show History | Pick from navigation history |

### 📍 From bindings to steps (usages)
In step definition files (.cs, .ts, .py, etc.), CodeLens above each binding shows how many steps use it:
- **→ 1 usage (Scenario name)** — click to open the step in the feature file
- **→ N usages (M scenarios)** — click to pick a usage from a list and jump to it  
Works with any indexed framework (Reqnroll, SpecFlow, and future Cucumber.js, Behave, etc.).

### 🏥 BDD Coach (optional)

Best-practice hints for `.feature` files (duplicate steps, GWT structure, vague Then, step length, UI leakage, etc.).

| Setting | Default | Description |
|---------|---------|-------------|
| `bddGuardian.coach.enabled` | `false` | Enable Coach diagnostics in the Problems panel |
| `bddGuardian.coach.statusBar.enabled` | `true` | Health score in the status bar when Coach is on |

Commands: **BDD Guardian: Toggle Coach Mode**, **Show Coach Rules**, **Show Health Score**.

### 🔍 Diagnostics
Warnings in the Problems panel for:
- Unbound steps (no matching binding)
- Ambiguous steps (multiple bindings match)

Updates while typing in `.feature` files (debounced), aligned with the workspace index.

### 📋 Scenario Outline Support
Full support for Scenario Outlines with Examples tables:
- Automatically expands `<placeholders>` with Example values
- Accurate binding resolution for parameterized steps

### 🔌 Multi-Framework Support
Automatic detection of BDD frameworks:
- ✅ **C# Reqnroll** — Full navigation (current open-source stack)
- ✅ **C# SpecFlow** — Same attribute-based bindings as Reqnroll; shared parser, separate NuGet detection
- ✅ JavaScript Cucumber.js (v0.6.1+)
- ✅ Go Godog (v0.7.0+)
- ✅ Python Behave (v0.7.1+)
- ✅ Java Cucumber-JVM (v0.9.0+)

#### C# step bindings (Reqnroll & SpecFlow)

Reqnroll and SpecFlow share the same binding model (`[Binding]`, `[Given(@"...")]`, etc.). BDD Guardian indexes both with one C# parser — Reqnroll is the active open-source line; legacy SpecFlow projects get the same CodeLens, Go to Definition, and diagnostics.

**Recommended flow:** Guardian (navigate & validate) → [BDD Pilot](https://github.com/AngHelll/bdd-pilot) (run `dotnet test`) → if `PENDING_STEPS` or `AMBIGUOUS_STEPS`, fix bindings and re-open in Guardian. Sample pair: [`samples/binding-demo/`](./samples/binding-demo/) + Pilot [`samples/minimal-bdd`](https://github.com/AngHelll/bdd-pilot/tree/main/samples/minimal-bdd).

## 📦 Installation

### From VSIX (Current)
1. Download the `.vsix` file
2. In VS Code: `Cmd+Shift+P` → "Install from VSIX"
3. Select the downloaded file

### From Marketplace
Search for "BDD Guardian" in VS Code Extensions, or install from:  
[Marketplace](https://marketplace.visualstudio.com/items?itemName=anghelll-bdd-guardian.bdd-guardian)

## ⚙️ Configuration

### Language

| Setting | Default | Description |
|---------|---------|-------------|
| `bddGuardian.displayLanguage` | `en` | UI language for messages (toasts, status bar, hover). `en` = English, `es` = Spanish. If unset, follows VS Code display language. |

### Visual Feedback

| Setting | Default | Description |
|---------|---------|-------------|
| `bddGuardian.gutterIcons.enabled` | `true` | Show gutter icons for step status |
| `bddGuardian.hoverDetails.enabled` | `true` | Show enriched hover with code preview |
| `bddGuardian.ui.showMatchScore` | `false` | Show numeric match score in bound step CodeLens (debug) |
| `bddGuardian.onboarding.enabled` | `true` | One-time hint when features exist but no bindings are indexed |
| `bddGuardian.authorActions.enabled` | `true` | Quick fixes on unbound steps: copy snippet/pattern; generate scaffold (C# / JS/TS) |
| `bddGuardian.autocomplete.enabled` | `true` | Suggest step text from indexed bindings while typing in `.feature` files |

### Autocomplete

While typing a Gherkin step (`Given` / `When` / `Then` / `And` / `But`), IntelliSense suggests steps from the **same index** used by CodeLens and diagnostics (keyword + prefix filter; patterns are humanized for insert). Autocomplete does not invent steps and does not run tests — use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) to execute.

Disable with `bddGuardian.autocomplete.enabled: false`.

### Author actions

On **unbound** steps (Problems panel or lightbulb), BDD Guardian offers:

- **Copy binding snippet** — framework-aware step definition text (same as hover v1.0.1)
- **Copy suggested pattern** — regex/Cucumber pattern only
- **Generate binding (insert)** — inserts scaffold into an indexed step-definition file, or creates `StepDefinitions/GuardianGeneratedSteps.cs` / `features/step_definitions/guardian-generated.steps.ts` (C# Reqnroll/SpecFlow and Cucumber.js only; Python/Go/Java: copy actions only)

After generate, **reindex** the workspace to verify the step is bound. Run tests with **BDD Pilot** when ready.

Disable with `bddGuardian.authorActions.enabled: false`.


Keys under `reqnrollNavigator.*` are **legacy IDs** kept for backward compatibility — do not rename in settings JSON. New UX settings use `bddGuardian.*`.

| Setting | Namespace | Role |
|---------|-----------|------|
| `bddGuardian.displayLanguage` | branding | UI language (EN/ES) for status labels, toasts, hover |
| `bddGuardian.gutterIcons.enabled` | branding | Gutter icons on steps |
| `bddGuardian.hoverDetails.enabled` | branding | Rich binding hover |
| `bddGuardian.ui.showMatchScore` | branding | CodeLens debug score |
| `bddGuardian.matching.preferSpecificBinding` | branding | Ambiguity policy |
| `bddGuardian.providers.indexMode` | branding | `all` vs `primary` provider indexing |
| `bddGuardian.onboarding.enabled` | branding | First-run zero-bindings hint |
| `bddGuardian.authorActions.enabled` | branding | Unbound step copy/generate quick fixes |
| `bddGuardian.autocomplete.enabled` | branding | Step IntelliSense from indexed bindings |
| `bddGuardian.coach.*` | branding | Coach rules and UI |
| `reqnrollNavigator.enableCodeLens` | legacy | CodeLens on/off |
| `reqnrollNavigator.enableDiagnostics` | legacy | Problems panel unbound/ambiguous |
| `reqnrollNavigator.enableDecorations` | legacy | Gutter border / overview ruler |
| `reqnrollNavigator.caseInsensitive` | legacy | Case-insensitive matching |
| `reqnrollNavigator.tagFilter` / `tagFilterMode` | legacy | Filter steps in CodeLens/diagnostics |
| `reqnrollNavigator.featureGlob` / `bindingsGlob` | legacy | Index globs |
| `reqnrollNavigator.excludePatterns` | legacy | Index exclusions |
| `reqnrollNavigator.navigationHistorySize` | legacy | Back/forward history size |
| `reqnrollNavigator.debug` | legacy | Verbose output |

### Matching

| Setting | Default | Description |
|---------|---------|-------------|
| `bddGuardian.matching.preferSpecificBinding` | `false` | When multiple bindings match, pick highest score (`true`, legacy). Default `false`: show ambiguous (Reqnroll-like). |

### Core Features

| Setting | Default | Description |
|---------|---------|-------------|
| `reqnrollNavigator.enableCodeLens` | `true` | Show CodeLens above steps |
| `reqnrollNavigator.enableDiagnostics` | `true` | Show problems for unbound steps |
| `reqnrollNavigator.enableDecorations` | `true` | Show border and overview ruler |
| `reqnrollNavigator.navigationHistorySize` | `50` | Max items in navigation history |

### Indexing

| Setting | Default | Description |
|---------|---------|-------------|
| `bddGuardian.providers.indexMode` | `all` | `all` = index every detected provider; `primary` = only the highest-confidence provider |
| `reqnrollNavigator.bindingsGlob` | `**/*.cs` | Paths to search for bindings |
| `reqnrollNavigator.excludePatterns` | `[**/bin/**, **/obj/**]` | Paths to exclude |

## 🐛 Known Issues

- Large projects may experience initial indexing delay (status bar shows “Indexing…” while running)
- Advanced regex in bindings (lookaheads, complex nested groups) may not match as in the test runner; standard alternation `(a|b)` is covered by tests ([details](docs/BINDING_MATCHING.md))

## Sample workspace

[`samples/binding-demo/`](./samples/binding-demo/) is a minimal Reqnroll workspace for manual verification: install VSIX → open that folder → CodeLens + Go to Definition on `Features/sample.feature`. For test **execution**, use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) `samples/minimal-bdd`.

Maintainers: `npm run verify:local` runs lint, tests, and packages `bdd-guardian.vsix` (Capa A); see [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

See [ROADMAP.md](./ROADMAP.md). Current release is **v1.0.0**. Works alongside [BDD Pilot](https://github.com/AngHelll/bdd-pilot) (test execution) and [BDD Jarvis](https://github.com/AngHelll/bdd-jarvis) (Index API).

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [docs/README.md](docs/README.md) | Doc index and product direction |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Extension architecture |
| [docs/VISUAL_LANGUAGE.md](docs/VISUAL_LANGUAGE.md) | Icons, colors, and status semantics |
| [docs/BINDING_MATCHING.md](docs/BINDING_MATCHING.md) | Step-to-binding matching |
| [docs/PROVIDERS.md](docs/PROVIDERS.md) | Adding a framework provider |
| [ROADMAP.md](./ROADMAP.md) | Done vs planned features |

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss proposed changes.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by the Reqnroll, SpecFlow, and Cucumber communities
- Built with ❤️ for BDD practitioners

## 🏢 Enterprise Features

BDD Guardian is designed for enterprise-scale projects:

### Performance Guardrails
- **Max Files Limit**: Configurable limit (default: 5,000) prevents memory issues in large monorepos
- **Batch Processing**: Files are indexed in batches to keep VS Code responsive
- **Async Operations**: All indexing is non-blocking

### Resilience
- **Safe Fallbacks**: Extension never crashes - all operations are wrapped in try/catch
- **Graceful Degradation**: If provider detection fails, falls back to manual configuration
- **Detailed Logging**: Output channel shows all operations for troubleshooting

### Configuration for Large Projects

```json
{
  "reqnrollNavigator.maxFilesIndexed": 10000,
  "reqnrollNavigator.excludePatterns": [
    "**/bin/**",
    "**/obj/**",
    "**/node_modules/**",
    "**/TestResults/**"
  ]
}
```

