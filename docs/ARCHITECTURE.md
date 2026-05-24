# BDD Guardian Architecture

This document provides a detailed overview of the BDD Guardian extension architecture.

**See also:** [docs/README.md](./README.md) (doc index), [BINDING_MATCHING.md](./BINDING_MATCHING.md), [ROADMAP.md](./ROADMAP.md).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                         │
├─────────────────────────────────────────────────────────────────┤
│  extension.ts                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │  Activation  │ │   Commands   │ │    Events    │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                         Features Layer                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Definition │ │  CodeLens  │ │   Hover    │ │Diagnostics │   │
│  │  Provider  │ │  Provider  │ │  Provider  │ │   Engine   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                          Core Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  WorkspaceIndex │  │    Resolver     │  │     Scoring     │ │
│  │   (Bindings +   │  │  (Step→Binding) │  │   (Matching)    │ │
│  │    Features)    │  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                        Providers Layer                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Reqnroll │ │ SpecFlow │ │ Cucumber │ │  Behave  │   ...    │
│  │   (C#)   │ │   (C#)   │ │  (Java)  │ │ (Python) │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                    IndexManager + FileWatchers                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  IndexManager       │  │  Binding Providers  │              │
│  │  (.feature + .cs)   │  │  (Reqnroll, etc.)  │              │
│  └─────────────────────┘  └─────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. WorkspaceIndex

The central data store for all indexed information.

```typescript
class WorkspaceIndex {
    // Features
    getAllFeatures(): FeatureDocument[]
    getStepsForUri(uri): FeatureStep[]
    
    // Bindings
    getAllBindings(): Binding[]
    getBindingsByKeyword(keyword): Binding[]
    getBindingsByProvider(providerId): Binding[]
    
    // Stats
    getStats(): { featureCount, stepCount, bindingCount }
}
```

**Data Flow:**
```
File System → IndexManager (providers) → WorkspaceIndex → Resolver → Features
```

### 2. Resolver

Matches feature steps to bindings using pattern matching and scoring.

```typescript
interface ResolveResult {
    step: FeatureStep;
    candidates: MatchCandidate[];  // Sorted by score
    bestMatch: MatchCandidate | null;
    isAmbiguous: boolean;
}

interface MatchCandidate {
    binding: Binding;
    score: number;
    matchType: 'exact' | 'regex' | 'fallback';
}
```

**Resolution Process:**
1. Get step text and keyword
2. Find bindings with matching keyword
3. Test each binding's regex against step text
4. Score matches by specificity
5. Sort by score (descending)
6. Detect ambiguity if multiple high-scoring matches

### 3. Scoring Algorithm

```typescript
function calculateScore(binding, stepText): number {
    let score = 0;
    
    // Base score for match
    score += 50;
    
    // Specificity bonus
    if (hasNumericPattern(binding)) score += 20;  // \d+
    if (hasQuotedPattern(binding)) score += 15;   // "[^"]*"
    if (hasWildcard(binding)) score -= 10;        // .*
    
    // Exact match bonus
    if (isExactMatch(binding, stepText)) score += 30;
    
    return score;
}
```

### 4. Provider System

Providers implement framework-specific detection and parsing.

```typescript
interface IBindingProvider {
    // Identity
    readonly id: BindingProviderId;
    readonly displayName: string;
    readonly languages: string[];
    
    // Detection
    detect(folders): Promise<ProviderDetectionReport>;
    
    // Indexing
    getBindingFilePattern(): string;
    parseBindingFile(document): Binding[];
}
```

**Provider Detection Flow:**
```
Workspace Open
      ↓
ProviderManager.detectProviders()
      ↓
┌─────────────────────────────────┐
│  For each registered provider:  │
│  1. Check indicators            │
│  2. Calculate confidence        │
│  3. Return report               │
└─────────────────────────────────┘
      ↓
Select providers with confidence > threshold
      ↓
Index bindings from selected providers
```

## Feature Implementations

### Definition Provider

```typescript
class DefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document, position): Location[] {
        const step = index.getStepAtPosition(uri, position);
        const result = resolver.resolve(step);
        return result.candidates.map(c => c.binding.location);
    }
}
```

### CodeLens Provider

Parses the **open document** line-by-line (not a stale index) so CodeLens stays correct while typing. Uses the workspace index only for **bindings** when resolving each step.

```typescript
class CodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document): CodeLens[] {
        // Walk document lines → build step + candidateTexts (incl. Scenario Outline)
        // resolve(step) against index.getAllBindings()
        return codeLenses;
    }
}
```

### Diagnostics Engine

Same pattern: reads the **current document text**, resolves against indexed bindings, replaces diagnostics for that URI via `DiagnosticCollection.set`.

### Coach Diagnostics

Uses `parseFeatureDocument` (core) → `GherkinModel` → rule engine. Subscribes to `onDidChangeTextDocument` for `feature` / `gherkin` / `*.feature` (debounced). Separate diagnostic source: `BDD Coach`.

### Reference Provider (Find All References)

`core/references` implements binding ↔ step lookup. `ReferenceProvider` registers for feature and binding document selectors (Shift+F12).

- **From binding:** `findReferencesForBinding` — all indexed steps that resolve to that attribute line.
- **From step:** `findReferencesForStep` — same normalized text and/or same binding match across indexed features.

Binding CodeLens reuses the same finder; bindings are listed via `getBindingsForUri(allBindings, uri)`.

## Data Models

### FeatureStep

```typescript
interface FeatureStep {
    keywordOriginal: string;      // "Given", "When", "Then", "And", "But"
    keywordResolved: ResolvedKeyword;  // Resolved to Given/When/Then
    rawText: string;              // Original step text
    normalizedText: string;       // Whitespace-normalized
    fullText: string;             // Keyword + text
    uri: vscode.Uri;
    range: vscode.Range;
    lineNumber: number;
    isOutline: boolean;           // Is Scenario Outline step
    candidateTexts: string[];     // Expanded from Examples
    tagsEffective: string[];
}
```

### Binding

```typescript
interface Binding {
    keyword: ResolvedKeyword;
    patternRaw: string;           // Original pattern string
    regex: RegExp;                // Compiled regex
    className: string;
    methodName: string;
    uri: vscode.Uri;
    range: vscode.Range;
    lineNumber: number;
    signature: string;            // "ClassName.MethodName"
}
```

## Scenario Outline Expansion

When a step is part of a Scenario Outline, we expand placeholders:

```gherkin
Scenario Outline: Login
  When I login as "<user>" with "<password>"
  
  Examples:
    | user  | password |
    | admin | secret   |
    | guest | guest123 |
```

Generates candidate texts:
- `I login as "admin" with "secret"`
- `I login as "guest" with "guest123"`
- `I login as "X" with "X"` (fallback)

## Navigation History

Tracks navigation between features and bindings:

```typescript
class NavigationHistoryManager {
    private history: NavigationLocation[];
    private currentIndex: number;
    
    push(location): void;
    goBack(): Promise<boolean>;
    goForward(): Promise<boolean>;
}
```

## Configuration

```typescript
interface ExtensionConfig {
    // Provider settings
    caseInsensitiveMatching: boolean;
    
    // Diagnostic settings
    diagnostics: {
        enabled: boolean;
        showUnboundSteps: boolean;
        showAmbiguousSteps: boolean;
    };
    
    // UI settings
    gutterIcons: { enabled: boolean };
    hoverDetails: { enabled: boolean };
    
    // Performance
    maxExampleRows: number;
}
```

## File Watching and live edit

| Trigger | Behavior |
|---------|----------|
| `onDidChangeTextDocument` (`.feature`) | Debounced reindex from **open buffer** + refresh CodeLens, diagnostics, decorations |
| `onDidSaveTextDocument` (`.feature`) | Immediate reindex from buffer + UI refresh |
| `FileSystemWatcher` (`.feature` / bindings glob) | Debounced reindex from disk (e.g. external edits) |
| Full workspace index | `IndexManager.indexAll()` on activation / reindex command |

```typescript
class FileWatchers {
    featureWatcher: FileSystemWatcher;   // config.featureGlob
    bindingWatcher: FileSystemWatcher;  // config.bindingsGlob

    onFeatureChange → indexFeatureFile(uri)  // prefers open TextDocument if present
    onBindingChange → removeBindingsForUri(uri) + addBindings(...)
}
```

Incremental binding updates **must** call `removeBindingsForUri` before `addBindings`; otherwise bindings accumulate on each save.

## Error Handling

All components use defensive programming:

```typescript
try {
    const regex = compileBindingRegex(pattern);
    if (!regex) {
        console.warn('Invalid pattern:', pattern);
        return null;
    }
} catch (error) {
    console.error('Unexpected error:', error);
    return null;
}
```

## Performance Considerations

1. **Lazy indexing**: Only index files when needed
2. **Caching**: Cache compiled regexes and resolution results
3. **Debouncing**: Debounce file change events (200ms)
4. **Limiting**: Cap example expansion to 20 rows
5. **Incremental updates**: Update only changed files
