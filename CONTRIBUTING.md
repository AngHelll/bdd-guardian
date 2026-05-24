# Contributing to BDD Guardian

Thank you for your interest in contributing to BDD Guardian! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding a New Provider](#adding-a-new-provider)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **VS Code** 1.85.0 or higher
- **Git**

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/bdd-guardian.git
cd bdd-guardian
```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile the Extension

```bash
npm run compile
```

### 3. Run in Development Mode

Press `F5` in VS Code to launch the Extension Development Host.

### 4. Run Tests

```bash
npm test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile TypeScript |
| `npm run watch` | Compile in watch mode |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run package` | Create VSIX package |

## Project Architecture

```
src/
├── core/                    # Core business logic (framework-agnostic)
│   ├── domain/              # Types, interfaces, constants
│   ├── index/               # Workspace indexing (features, bindings)
│   ├── matching/            # Step-to-binding resolution
│   │   ├── resolver.ts      # Main resolver logic
│   │   ├── scoring.ts       # Match scoring algorithm
│   │   └── normalization.ts # Text normalization
│   └── parsing/             # Regex compilation, parsing utilities
│
├── providers/               # BDD framework providers
│   └── bindings/
│       ├── types.ts         # Provider interfaces
│       ├── providerManager.ts
│       └── implementations/
│           ├── csharpReqnroll.ts
│           ├── csharpSpecflow.ts
│           └── ... (other providers)
│
├── features/                # VS Code feature implementations
│   ├── navigation/          # Go to Definition, CodeLens, history
│   ├── diagnostics/         # Diagnostics, decorations
│   ├── coach/               # BDD Coach rules and diagnostics
│   └── hovers/              # Hover information
│
├── providers/bindings/      # Framework providers (see docs/PROVIDERS.md)
├── ui/                      # UI utilities (icons, status)
├── config/                  # Extension settings
└── extension.ts             # Extension entry point
```

See also [docs/README.md](docs/README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/ROADMAP.md](docs/ROADMAP.md).

### Key Concepts

#### 1. Providers
Providers detect and parse BDD frameworks. Each provider implements `IBindingProvider`:

```typescript
interface IBindingProvider {
  id: string;
  displayName: string;
  detect(workspace): Promise<ProviderDetectionReport>;
  indexBindings(workspace): Promise<Binding[]>;
}
```

#### 2. Resolver
The resolver matches feature steps to bindings using regex patterns and scoring:

```typescript
const result = resolver.resolve(step);
// result.candidates: sorted by score (best match first)
```

#### 3. Scoring
Matches are scored based on:
- Pattern specificity (`\d+` > `.*`)
- Exact vs partial match
- Keyword match (Given/When/Then)

## Making Changes

### Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
docs/description       # Documentation
refactor/description   # Code refactoring
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Python Behave provider
fix: resolve ambiguous match scoring
docs: update architecture overview
test: add scoring edge cases
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Test Structure

```
src/__tests__/
├── fixtures/              # Test data (feature files, bindings)
├── mocks/                 # VS Code API mocks
├── resolver.test.ts       # Resolver tests
├── scoring.test.ts        # Scoring algorithm tests
├── bindingRegex.test.ts   # Regex compilation tests
├── ambiguity.test.ts      # Ambiguity detection tests
├── parsing.test.ts        # Parsing tests
├── coach.test.ts          # Coach rules
├── workspaceIndex.test.ts # Index mutations
└── exampleExpansion.test.ts  # Scenario Outline tests
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
    it('should do something', () => {
        const result = myFunction(input);
        expect(result).toBe(expected);
    });
});
```

## Submitting Changes

### Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** with tests
3. **Run the full test suite**: `npm test`
4. **Run linting**: `npm run lint`
5. **Push** and create a Pull Request

### PR Checklist

- [ ] Tests added/updated
- [ ] Linting passes
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG updated (for features/fixes)

## Adding a New Provider

Want to add support for a new BDD framework? Here's how:

### 1. Create Provider File

```typescript
// src/providers/bindings/myFrameworkProvider.ts
import { IBindingProvider, ProviderDetectionReport } from './types';

export class MyFrameworkProvider implements IBindingProvider {
    readonly id = 'my-framework';
    readonly displayName = 'My Framework';
    readonly languages = ['python'];  // or ['csharp', 'java', etc.]
    
    async detect(workspaceFolders): Promise<ProviderDetectionReport> {
        // Check for framework indicators (package.json, requirements.txt, etc.)
        // Return confidence score 0-100
    }
    
    getBindingFilePattern(): string {
        return '**/*_steps.py';  // Glob pattern for binding files
    }
    
    async parseBindingFile(document): Promise<Binding[]> {
        // Parse the file and extract bindings
    }
}
```

### 2. Register Provider

```typescript
// src/providers/bindings/providerManager.ts
import { MyFrameworkProvider } from './myFrameworkProvider';

const PROVIDERS: IBindingProvider[] = [
    // ... existing providers
    new MyFrameworkProvider(),
];
```

### 3. Add Tests

```typescript
// src/__tests__/providers/myFramework.test.ts
describe('MyFrameworkProvider', () => {
    it('should detect framework', async () => {
        // ...
    });
    
    it('should parse binding patterns', () => {
        // ...
    });
});
```

### Provider Detection Tips

- Check for config files (e.g., `behave.ini`, `cucumber.yml`)
- Check for dependencies in package managers
- Return confidence scores based on multiple signals
- Handle edge cases gracefully

## Questions?

- Open an [issue](https://github.com/AngHelll/bdd-guardian/issues)
- Start a [discussion](https://github.com/AngHelll/bdd-guardian/discussions)

Thank you for contributing! ��
