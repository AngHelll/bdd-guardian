# BDD Guardian 🛡️

> Guard and navigate your BDD steps across Reqnroll, SpecFlow, and Cucumber!

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=anghelll.bdd-guardian)
[![Tests](https://img.shields.io/badge/tests-65%20passing-brightgreen.svg)](https://github.com/AngHelll/bdd-guardian)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.txt)

> ⚠️ **Alpha Release** - This extension is in early development (v0.1.0).  
> Breaking changes may occur between versions. Please report issues on [GitHub](https://github.com/AngHelll/bdd-guardian/issues).

A VS Code extension that provides intelligent navigation, CodeLens indicators, diagnostics, navigation history, and visual feedback for BDD projects using Reqnroll, SpecFlow, Cucumber, and more.

## ✨ Features

### 🔗 Go to Definition
Click on any step in a `.feature` file and jump directly to its binding using **F12** or **Cmd+Click** (Ctrl+Click on Windows).

### 📊 CodeLens
See binding status directly above each step:
- ✅ **Bound**: Shows `ClassName.MethodName` - click to navigate
- ⚠️ **Unbound**: Warning when no binding is found
- ⚡ **Ambiguous**: Multiple bindings match - click to select

### 🎯 Gutter Icons
Visual indicators in the editor gutter:
- ✓ Green checkmark for bound steps
- ✗ Red X for unbound steps
- ! Orange warning for ambiguous steps

### 🧭 Navigation History
Navigate back and forward between steps and bindings:

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Alt+←` | Go Back | Return to previous location |
| `Alt+→` | Go Forward | Go to next location |
| `Alt+H` | Show History | Pick from navigation history |

A status bar indicator shows your current position: `← 3/5 →`

### 💬 Enriched Hover
Hover over any step to see:
- 📄 Code preview of the binding method
- 📊 Captured parameters table
- 🔗 Clickable navigation links
- 💡 Suggested binding patterns for unbound steps

### 🔍 Diagnostics
Real-time warnings in the Problems panel for:
- Unbound steps (no matching binding)
- Ambiguous steps (multiple bindings match)

### 🏷️ Tag Filtering
Filter steps by tags (`@P0`, `@smoke`, etc.) to focus on specific scenarios.

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
- 🔜 Go Godog (planned)

## �� Installation

### From VSIX (Current)
1. Download the `.vsix` file
2. In VS Code: `Cmd+Shift+P` → "Install from VSIX"
3. Select the downloaded file

### From Marketplace (Coming Soon)
Search for "BDD Guardian" in VS Code Extensions.

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `bddGuardian.enableCodeLens` | `true` | Show CodeLens above steps |
| `bddGuardian.enableDiagnostics` | `true` | Show problems for unbound steps |
| `bddGuardian.enableDecorations` | `true` | Show gutter icons and decorations |
| `bddGuardian.navigationHistorySize` | `50` | Max items in navigation history |
| `bddGuardian.bindingSearchPaths` | `["**/*.cs"]` | Paths to search for bindings |
| `bddGuardian.excludePaths` | `["**/bin/**", "**/obj/**"]` | Paths to exclude |

## 🐛 Known Issues

- Large projects may experience initial indexing delay
- Some complex regex patterns may not match correctly

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss proposed changes.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## 🙏 Acknowledgments

- Inspired by the Reqnroll, SpecFlow, and Cucumber communities
- Built with ❤️ for BDD practitioners
