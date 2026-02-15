# BDD Guardian Architecture

This document provides a detailed overview of the BDD Guardian extension architecture.

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

```typescript
class CodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document): CodeLens[] {
        const steps = index.getStepsForUri(uri);
        return steps.map(step => {
            const result = resolver.resolve(step);
            return new CodeLens(step.range, {
                title: formatCodeLensTitle(result),
                command: 'reqnroll-navigator.goToStep',
                arguments: [result]
            });
        });
    }
}
```

### Diagnostics Engine

```typescript
class DiagnosticsEngine {
    analyzeFile(document): Diagnostic[] {
        const diagnostics = [];
        const steps = index.getStepsForUri(uri);
        
        for (const step of steps) {
            const result = resolver.resolve(step);
            
            if (result.candidates.length === 0) {
                diagnostics.push(unboundStepDiagnostic(step));
            } else if (result.isAmbiguous) {
                diagnostics.push(ambiguousStepDiagnostic(step, result));
            }
        }
        
        return diagnostics;
    }
}
```

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

## File Watching

The extension watches for file changes to keep the index up-to-date:

```typescript
class FileWatchers {
    // Feature files
    featureWatcher: FileSystemWatcher;  // **/*.feature
    
    // Binding files (per provider)
    bindingWatchers: Map<ProviderId, FileSystemWatcher>;
    
    // Events
    onFeatureChange → reindex feature file
    onBindingChange → reindex binding file
}
```

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
