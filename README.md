# Reqnroll Navigator

> Navigate between Gherkin `.feature` steps and Reqnroll C# step bindings with ease!

A VS Code extension that provides intelligent navigation, CodeLens indicators, diagnostics, and tag filtering for Reqnroll/SpecFlow BDD projects.

## ✨ Features

### 🔗 Go to Definition
Click on any step in a `.feature` file and jump directly to its C# binding using **F12** or **Cmd+Click** (Ctrl+Click on Windows).

### 📊 CodeLens
See binding status directly above each step:
- ✓ **Bound**: Shows `ClassName.MethodName` - click to navigate
- ⚠ **Unbound**: Warning when no binding is found
- ⚡ **Ambiguous**: Multiple bindings match - click to select

### 🔍 Diagnostics
Real-time warnings in the Problems panel for:
- Unbound steps (no matching binding)
- Ambiguous steps (multiple bindings match)

### 🏷️ Tag Filtering
Filter steps by tags (`@P0`, `@smoke`, etc.) to focus on specific scenarios.

### 🔌 Multi-Provider Architecture
Automatic detection of BDD frameworks:
- ✅ **C# Reqnroll** - Fully implemented
- 🔜 C# SpecFlow (stub)
- 🔜 JavaScript Cucumber (stub)
- 🔜 Java Cucumber (stub)
- 🔜 Python Behave (stub)
- 🔜 Python pytest-bdd (stub)
- 🔜 Go Godog (stub)

## 📦 Installation

### From VSIX file
```bash
code --install-extension reqnroll-navigator-2.0.0.vsix
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

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `Reqnroll: Reindex Workspace` | Re-scan all feature and binding files |
| `Reqnroll: Show All Bindings` | Display all indexed bindings |
| `Reqnroll: Go to Step Binding` | Navigate to binding for current step |
| `Reqnroll Navigator: Show Provider Detection Report` | Debug provider detection |

## 📋 Requirements

- VS Code 1.85.0 or higher
- A workspace with `.feature` files and C# Reqnroll bindings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Reqnroll](https://reqnroll.net/) - The open-source Cucumber implementation for .NET
- [Gherkin](https://cucumber.io/docs/gherkin/) - Business readable language for BDD
