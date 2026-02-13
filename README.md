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

---

## 🔧 Developer Notes

### Scenario Outline + Examples Matching

The extension handles `Scenario Outline` steps with `<placeholders>` by expanding them with actual values from `Examples` tables. This dramatically reduces false negatives.

#### How it works:

1. **Parsing Phase** (`featureIndexer.ts`):
   - When parsing a `.feature` file, the indexer detects `Scenario Outline:` blocks
   - It captures the `Examples:` tables with headers and data rows
   - Steps within the outline receive a reference to their Examples

2. **Candidate Generation** (`generateCandidateTexts()`):
   - For each step with `<placeholders>`, we generate multiple candidate strings:
     - **Fallback**: `<placeholder>` → `X` (e.g., "I enter X into the calculator")
     - **Expanded**: Replace with actual values from Examples rows
   - Limited to `MAX_CANDIDATES_PER_STEP` (25) for performance

3. **Matching Phase** (`matcher.ts` / `resolver.ts`):
   - The binding's compiled regex is tested against ALL candidates
   - If ANY candidate matches → **BOUND**
   - The `matchedCandidate` is stored for debugging/hover

#### Example:

```gherkin
Scenario Outline: Calculator addition
  When I enter <amount> into the calculator
  
  Examples:
    | amount |
    | 50     |
    | 100    |
```

Binding: `[When(@"I enter (\d+) into the calculator")]`

Generated candidates:
1. `"I enter X into the calculator"` (fallback)
2. `"I enter 50 into the calculator"` ← matches `\d+` ✓
3. `"I enter 100 into the calculator"` ← matches `\d+` ✓

Result: **BOUND** (matched via candidate #2 or #3)

### Whitespace Normalization

All step text is normalized before matching:
- Multiple spaces/tabs collapsed to single space
- Leading/trailing whitespace trimmed
- Original text preserved for display

```typescript
normalizeWhitespace("  hello   world  ") // → "hello world"
```

### C# Verbatim String Handling

The C# parser (`csBindingParser.ts`) correctly handles verbatim strings:

```csharp
// Regular string - backslash escapes
[When("value is \"quoted\"")]

// Verbatim string (@"...") - double quotes escape
[When(@"value is ""quoted""")]
// Both produce pattern: value is "quoted"
```

### Scoring Algorithm

When multiple bindings match, we score them by specificity:

| Factor | Score Impact |
|--------|--------------|
| Keyword match (Given/When/Then) | +120 |
| Anchored pattern (`^...$`) | +30 |
| Specific capture (`\d+`, `\w+`) | +20 per group |
| Literal characters | +1 per char |
| Generic wildcard (`.*`) | -15 per occurrence |
| Keyword fallback | -40 |

Higher score wins. If top two scores are equal → **AMBIGUOUS**

### Performance Considerations

- Example expansion limited to first 20 rows per table
- Total candidates capped at 25 per step
- File watchers use 300ms debounce
- UI updates use 200ms debounce
- Only active editor gets decorations
