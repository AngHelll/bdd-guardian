/**
 * Shared VS Code document selectors for Gherkin and binding files.
 */

import * as vscode from 'vscode';

export const FEATURE_DOCUMENT_SELECTORS: vscode.DocumentSelector = [
    { language: 'gherkin', scheme: 'file' },
    { language: 'feature', scheme: 'file' },
    { language: 'cucumber', scheme: 'file' },
    { pattern: '**/*.feature', scheme: 'file' },
];

export const BINDING_DOCUMENT_SELECTORS: vscode.DocumentSelector = [
    { language: 'csharp', scheme: 'file' },
    { language: 'typescript', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'python', scheme: 'file' },
    { language: 'go', scheme: 'file' },
];

export const REFERENCE_DOCUMENT_SELECTORS: vscode.DocumentSelector = [
    ...FEATURE_DOCUMENT_SELECTORS,
    ...BINDING_DOCUMENT_SELECTORS,
];
