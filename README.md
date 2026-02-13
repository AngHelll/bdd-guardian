# Reqnroll Navigator

> Navigate between Gherkin `.feature` steps and Reqnroll/SpecFlow C# step bindings with ease!

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=anghelll.reqnroll-navigator)
[![Tests](https://img.shields.io/badge/tests-65%20passing-brightgreen.svg)](https://github.com/AngHelll/bdd-guardian)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A VS Code extension that provides intelligent navigation, CodeLens indicators, diagnostics, navigation history, and tag filtering for Reqnroll/SpecFlow BDD projects.

## ✨ Features

### 🔗 Go to Definition
Click on any step in a `.feature` file and jump directly to its C# binding using **F12** or **Cmd+Click** (Ctrl+Click on Windows).

### 📊 CodeLens
See binding status directly above each step:
- ✅ **Bound**: Shows `ClassName.MethodName` - click to navigate
- ⚠️ **Unbound**: Warning when no binding is found
- ⚡ **Ambiguous**: Multiple bindings match - click to select

### 🧭 Navigation History (New in v2.1)
Navigate back and forward between steps and bindings:

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Alt+←` | Go Back | Return to previous location |
| `Alt+→` | Go Forward | Go to next location |
| `Alt+H` | Show History | Pick from navigation history |

A status bar indicator shows your current position: `← 3/5 →`

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

### 🔌 Multi-Provider Architecture
Automatic detection of BDD frameworks:
- ✅ **C# Reqnroll** - Fully implemented
- ✅ **C# SpecFlow** - Fully implemented
- 🔜 JavaScript Cucumber
- 🔜 Java Cucumber
- 🔜 Python Behave/pytest-bdd
- 🔜 Go Godog

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search for "Reqnroll Navigator"
4. Click Install

### From VSIX file
```bash
code --install-extension reqnroll-navigator-2.1.0.vsix
```

### Manual Build
```bash
git clone https://github.com/AngHelll/bdd-guardian.git
cd reqnroll-navigator
npm install
npm run compile
npm run package
```

## ⚙️ Configuration

Access settings via **File > Preferences > Settings** and search for "Reqnroll Navigator".

| Setting | Default | Description |
|---------|---------|-------------|
| `caseInsensitive` | `false` | Enable case-insensitive step matching |
| `tagFilter` | `[]` | Filter steps by tags (e.g., `["@P0", "@smoke"]`) |
| `tagFilterMode` | `"include"` | `include` or `exclude` matching tags |
| `featureGlob` | `**/*.feature` | Glob pattern for feature files |
| `bindingsGlob` | `**/*.cs` | Glob pattern for binding files |
| `excludePatterns` | `["**/bin/**", "**/obj/**"]` | Patterns to exclude |
| `enableCodeLens` | `true` | Show CodeLens indicators |
| `enableDiagnostics` | `true` | Show diagnostic warnings |
| `enableDecorations` | `true` | Show visual decorations |
| `navigationHistorySize` | `50` | Max locations in navigation history |

## 🛠️ Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Reqnroll: Reindex Workspace` | - | Re-scan all feature and binding files |
| `Reqnroll: Show All Bindings` | - | Display all indexed bindings |
| `Reqnroll Navigator: Go Back` | `Alt+←` | Navigate to previous location |
| `Reqnroll Navigator: Go Forward` | `Alt+→` | Navigate to next location |
| `Reqnroll Navigator: Show History` | `Alt+H` | Show navigation history picker |
| `Reqnroll Navigator: Show Statistics` | - | Display indexing statistics |

## 📋 Requirements

- VS Code 1.85.0 or higher
- A workspace with `.feature` files and C# Reqnroll/SpecFlow bindings

## 🐛 Known Issues

- Navigation history shortcuts only work when editing `.feature` files
- Some complex regex patterns in bindings may not match correctly

## 📝 Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### 2.1.0
- Navigation History with back/forward support
- Improved Scenario Outline matching

### 2.0.0
- Multi-provider architecture
- 65 unit tests
- Enhanced matching accuracy

## 🤝 Contributing

Contributions are welcome! Please see our [GitHub repository](https://github.com/AngHelll/bdd-guardian).

## 📄 License

[MIT](LICENSE)

---

**Enjoy navigating your BDD tests"✅ CHANGELOG.md creado"* 🥒
