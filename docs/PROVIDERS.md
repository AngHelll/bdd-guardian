# Provider Interface Documentation

This document describes how to implement custom BDD framework providers for BDD Guardian.

## Overview

Providers are responsible for:
1. **Detection**: Determine if a workspace uses a specific BDD framework
2. **Indexing**: Parse binding files and extract step definitions
3. **Parsing**: Compile patterns to regex for matching

## Interface Definition

```typescript
interface IBindingProvider {
    /** Unique provider identifier */
    readonly id: BindingProviderId;
    
    /** Human-readable name */
    readonly displayName: string;
    
    /** Supported programming languages */
    readonly languages: string[];
    
    /** Framework website/docs URL */
    readonly frameworkUrl?: string;
    
    /**
     * Detect if this provider is applicable to the workspace.
     * Returns a report with confidence score (0-100).
     */
    detect(
        workspaceFolders: readonly vscode.WorkspaceFolder[]
    ): Promise<ProviderDetectionReport>;
    
    /**
     * Get glob pattern for binding files.
     * Example: "**/*.cs" for C#, "**/*_steps.py" for Python
     */
    getBindingFilePattern(): string;
    
    /**
     * Parse a single binding file and extract bindings.
     */
    parseBindingFile(
        document: vscode.TextDocument,
        options?: ParseOptions
    ): Binding[];
    
    /**
     * Index all bindings in the workspace.
     */
    indexBindings(
        workspaceFolders: readonly vscode.WorkspaceFolder[],
        options?: IndexOptions
    ): Promise<Binding[]>;
}
```

## Detection Report

```typescript
interface ProviderDetectionReport {
    /** Provider ID */
    readonly id: BindingProviderId;
    
    /** Display name */
    readonly displayName: string;
    
    /** Confidence score 0-100 */
    readonly confidence: number;
    
    /** Reasons for the score */
    readonly reasons: string[];
    
    /** Technical signals found */
    readonly signals: string[];
}
```

### Confidence Scoring Guidelines

| Score | Meaning | Example |
|-------|---------|---------|
| 90-100 | Definite match | Package reference + attribute usage |
| 70-89 | Very likely | Package reference found |
| 50-69 | Possible | Config file exists |
| 30-49 | Unlikely but possible | Similar naming conventions |
| 0-29 | Not applicable | No indicators found |

## Implementing a Provider

### Step 1: Create Provider Class

```typescript
// src/providers/bindings/implementations/pythonBehave.ts
import * as vscode from 'vscode';
import {
    IBindingProvider,
    BindingProviderId,
    ProviderDetectionReport,
    Binding,
} from '../types';

export class PythonBehaveProvider implements IBindingProvider {
    readonly id: BindingProviderId = 'python-behave';
    readonly displayName = 'Python Behave';
    readonly languages = ['python'];
    readonly frameworkUrl = 'https://behave.readthedocs.io/'\;
    
    async detect(
        workspaceFolders: readonly vscode.WorkspaceFolder[]
    ): Promise<ProviderDetectionReport> {
        let confidence = 0;
        const reasons: string[] = [];
        const signals: string[] = [];
        
        for (const folder of workspaceFolders) {
            // Check for behave.ini
            const behaveIni = await this.findFile(folder, 'behave.ini');
            if (behaveIni) {
                confidence += 40;
                reasons.push('Found behave.ini configuration');
                signals.push('behave.ini');
            }
            
            // Check for requirements.txt with behave
            const hasPackage = await this.checkRequirements(folder, 'behave');
            if (hasPackage) {
                confidence += 40;
                reasons.push('Found behave in requirements.txt');
                signals.push('requirements.txt:behave');
            }
            
            // Check for features directory
            const featuresDir = await this.findDirectory(folder, 'features');
            if (featuresDir) {
                confidence += 10;
                reasons.push('Found features directory');
                signals.push('features/');
            }
            
            // Check for steps directory
            const stepsDir = await this.findDirectory(folder, 'features/steps');
            if (stepsDir) {
                confidence += 10;
                reasons.push('Found steps directory');
                signals.push('features/steps/');
            }
        }
        
        return {
            id: this.id,
            displayName: this.displayName,
            confidence: Math.min(100, confidence),
            reasons,
            signals,
        };
    }
    
    getBindingFilePattern(): string {
        return '**/steps/**/*.py';
    }
    
    parseBindingFile(document: vscode.TextDocument): Binding[] {
        const bindings: Binding[] = [];
        const content = document.getText();
        const lines = content.split('\n');
        
        // Behave decorator pattern: @given('pattern'), @when('pattern'), @then('pattern')
        const decoratorRegex = /@(given|when|then)\s*\(\s*['"](.*?)['"]\s*\)/gi;
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            let match;
            
            decoratorRegex.lastIndex = 0;
            while ((match = decoratorRegex.exec(line)) !== null) {
                const keyword = this.normalizeKeyword(match[1]);
                const pattern = match[2];
                
                // Find function name on next lines
                const functionName = this.findFunctionName(lines, lineNum);
                
                const binding: Binding = {
                    keyword,
                    patternRaw: pattern,
                    regex: this.compilePattern(pattern),
                    className: 'steps',  // Python doesn't have classes typically
                    methodName: functionName,
                    uri: document.uri,
                    range: new vscode.Range(lineNum, 0, lineNum, line.length),
                    lineNumber: lineNum,
                    signature: functionName,
                };
                
                bindings.push(binding);
            }
        }
        
        return bindings;
    }
    
    async indexBindings(
        workspaceFolders: readonly vscode.WorkspaceFolder[]
    ): Promise<Binding[]> {
        const allBindings: Binding[] = [];
        const pattern = this.getBindingFilePattern();
        
        for (const folder of workspaceFolders) {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, pattern)
            );
            
            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const bindings = this.parseBindingFile(document);
                allBindings.push(...bindings);
            }
        }
        
        return allBindings;
    }
    
    // Helper methods
    private normalizeKeyword(keyword: string): 'Given' | 'When' | 'Then' {
        const lower = keyword.toLowerCase();
        if (lower === 'given') return 'Given';
        if (lower === 'when') return 'When';
        if (lower === 'then') return 'Then';
        return 'Given';  // fallback
    }
    
    private compilePattern(pattern: string): RegExp {
        // Convert Behave patterns to regex
        // Behave uses {name} for parameters
        let regexPattern = pattern
            .replace(/\{[^}]+\}/g, '(.+)')  // {param} → (.+)
            .replace(/\$/g, '\\$')          // Escape special chars
            .replace(/\./g, '\\.');
        
        return new RegExp(`^${regexPattern}$`, 'i');
    }
    
    private findFunctionName(lines: string[], startLine: number): string {
        for (let i = startLine + 1; i < Math.min(startLine + 5, lines.length); i++) {
            const match = lines[i].match(/def\s+(\w+)\s*\(/);
            if (match) {
                return match[1];
            }
        }
        return 'unknown';
    }
    
    private async findFile(folder: vscode.WorkspaceFolder, name: string): Promise<boolean> {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, `**/${name}`)
        );
        return files.length > 0;
    }
    
    private async findDirectory(folder: vscode.WorkspaceFolder, name: string): Promise<boolean> {
        const pattern = new vscode.RelativePattern(folder, `${name}/**`);
        const files = await vscode.workspace.findFiles(pattern, null, 1);
        return files.length > 0;
    }
    
    private async checkRequirements(folder: vscode.WorkspaceFolder, pkg: string): Promise<boolean> {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, '**/requirements*.txt')
        );
        
        for (const file of files) {
            const doc = await vscode.workspace.openTextDocument(file);
            if (doc.getText().includes(pkg)) {
                return true;
            }
        }
        return false;
    }
}
```

### Step 2: Register Provider

```typescript
// src/providers/bindings/providerManager.ts
import { PythonBehaveProvider } from './implementations/pythonBehave';

const PROVIDERS: IBindingProvider[] = [
    new CSharpReqnrollProvider(),
    new CSharpSpecFlowProvider(),
    new PythonBehaveProvider(),  // Add new provider
    // ... other providers
];
```

### Step 3: Add Tests

```typescript
// src/__tests__/providers/pythonBehave.test.ts
import { describe, it, expect } from 'vitest';
import { PythonBehaveProvider } from '../../providers/bindings/implementations/pythonBehave';

describe('PythonBehaveProvider', () => {
    const provider = new PythonBehaveProvider();
    
    describe('pattern compilation', () => {
        it('should compile simple pattern', () => {
            const bindings = provider.parseBindingFile(mockDocument(`
@given('I have {count} cucumbers')
def step_impl(context, count):
    pass
            `));
            
            expect(bindings).toHaveLength(1);
            expect(bindings[0].regex.test('I have 5 cucumbers')).toBe(true);
        });
        
        it('should handle multiple parameters', () => {
            const bindings = provider.parseBindingFile(mockDocument(`
@when('I eat {eaten} and have {remaining}')
def eat_step(context, eaten, remaining):
    pass
            `));
            
            expect(bindings[0].regex.test('I eat 3 and have 2')).toBe(true);
        });
    });
});
```

## Existing Providers

### C# Reqnroll

- **ID**: `csharp-reqnroll`
- **Pattern**: `**/*.cs`
- **Detection**: NuGet package `Reqnroll`, `[Binding]` attribute

### C# SpecFlow

- **ID**: `csharp-specflow`
- **Pattern**: `**/*.cs`
- **Detection**: NuGet package `SpecFlow`, `[Binding]` attribute

## Best Practices

### Detection

1. Use multiple signals for higher confidence
2. Check package managers first (most reliable)
3. Fall back to file/directory naming conventions
4. Don't return >50% confidence without strong signals

### Parsing

1. Handle multiline patterns gracefully
2. Support all keyword variations (Given/When/Then/And/But)
3. Compile patterns safely (catch regex errors)
4. Extract method names for better UX

### Performance

1. Use glob patterns efficiently
2. Cache compiled regexes
3. Process files in parallel when possible
4. Implement early exit for non-matching files

## Testing Your Provider

```bash
# Run all tests
npm test

# Run specific provider tests
npm test -- --grep "PythonBehave"

# Test detection in a real workspace
# 1. Add console.log to detect()
# 2. Open workspace with F5
# 3. Run "BDD Guardian: Show Provider Detection Report"
```
