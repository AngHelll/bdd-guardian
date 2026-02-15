# BDD Guardian 🛡️

> Guard and navigate your BDD steps across Reqnroll, SpecFlow, and Cucumber!

[![Version](https://img.shields.io/badge/version-0.4.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=anghelll-bdd-guardian.bdd-guardian)
[![Tests](https://img.shields.io/badge/tests-140%20passing-brightgreen.svg)](https://github.com/AngHelll/bdd-guardian)
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

A VS Code extension that provides intelligent navigation, visual feedback, and diagnostics for BDD projects using Reqnroll, SpecFlow, Cucumber, and more.

### ✨ What's improved (0.4.x)

- **C# verbatim patterns with quotes** — Bindings like `[When(@"they click on ""(.*)"" in the menu")]` now correctly match steps such as `When they click on "Projects" in the menu`.
- **Single architecture** — One indexing and resolution path (IndexManager + binding providers + core resolver); no duplicate logic, one regex compiler.
- **Unified Gherkin parsing** — Coach mode and the rest of the extension use the same core parser for `.feature` files.
- **UI language** — Optional English/Spanish for messages (status bar, hover, diagnostics) via `bddGuardian.displayLanguage`.
- **140 tests** — Broader coverage for matching, parsing, and Scenario Outline expansion.

### 📊 CodeLens
See binding status directly above each step:
- ✅ **Bound**: Shows `ClassName.MethodName` - click to navigate
- ⚠️ **Unbound**: Warning when no binding is found
- ⚡ **Ambiguous**: Multiple bindings match - click to select

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

### 🔍 Diagnostics
Real-time warnings in the Problems panel for:
- Unbound steps (no matching binding)
- Ambiguous steps (multiple bindings match)

### 📋 Scenario Outline Support
Full support for Scenario Outlines with Examples tables:
- Automatically expands `<placeholders>` with Example values
- Accurate binding resolution for parameterized steps

### 🔌 Multi-Framework Support
Automatic detection of BDD frameworks:
- ✅ **C# Reqnroll** - Fully implemented
- ✅ **C# SpecFlow** - Fully implemented  
- 🔜 JavaScript Cucumber (planned)
- 🔜 Python Behave (planned)

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
| `reqnrollNavigator.bindingsGlob` | `**/*.cs` | Paths to search for bindings |
| `reqnrollNavigator.excludePatterns` | `[**/bin/**, **/obj/**]` | Paths to exclude |

## 🐛 Known Issues

- Large projects may experience initial indexing delay (status bar shows “Indexing…” while running)
- Some complex regex patterns may not match correctly

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

