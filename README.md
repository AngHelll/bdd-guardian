# BDD Guardian 🛡️

> Guard and navigate your BDD steps across Reqnroll, SpecFlow, and Cucumber!

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=anghelll.bdd-guardian)
[![Tests](https://img.shields.io/badge/tests-65%20passing-brightgreen.svg)](https://github.com/AngHelll/bdd-guardian)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.txt)

> ⚠️ **Alpha Release** - This extension is in early development (v0.2.0).  
> Breaking changes may occur between versions. Please report issues on [GitHub](https://github.com/AngHelll/bdd-guardian/issues).

A VS Code extension that provides intelligent navigation, visual feedback, and diagnostics for BDD projects using Reqnroll, SpecFlow, Cucumber, and more.

## ✨ Features

### 🔗 Go to Definition
Click on any step in a `.feature` file and jump directly to its binding using **F12** or **Cmd+Click** (Ctrl+Click on Windows).

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

### From Marketplace (Coming Soon)
Search for "BDD Guardian" in VS Code Extensions.

## ⚙️ Configuration

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

- Large projects may experience initial indexing delay
- Some complex regex patterns may not match correctly

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss proposed changes.

## 📄 License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## 🙏 Acknowledgments

- Inspired by the Reqnroll, SpecFlow, and Cucumber communities
- Built with ❤️ for BDD practitioners
