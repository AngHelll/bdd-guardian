/**
 * JavaScript/TypeScript Cucumber Binding Provider (Stub)
 * 
 * Placeholder for future Cucumber.js support.
 */

import * as vscode from 'vscode';
import {
    IBindingProvider,
    BindingProviderId,
    DetectionResult,
    BindingIndexOptions,
    NOT_IMPLEMENTED_DETECTION,
} from './types';
import { Binding } from '../../core/domain';

/**
 * JavaScript Cucumber Binding Provider (Stub)
 */
export class JsCucumberProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'js-cucumber';
    public readonly displayName = 'JavaScript Cucumber';
    public readonly bindingFileExtensions = ['.js', '.ts', '.mjs', '.cjs'];
    public readonly bindingGlob = '**/*.{js,ts,mjs,cjs}';
    
    async detect(_workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        // TODO: Implement Cucumber.js detection
        // Signals: @cucumber/cucumber in package.json, Given/When/Then imports
        return NOT_IMPLEMENTED_DETECTION;
    }
    
    async indexBindings(
        _files: readonly vscode.Uri[],
        _options?: BindingIndexOptions
    ): Promise<Binding[]> {
        // TODO: Implement Cucumber.js binding parsing
        // Look for: Given('pattern', callback), When(/regex/, callback), etc.
        return [];
    }
    
    parseFile(
        _document: vscode.TextDocument,
        _options?: BindingIndexOptions
    ): Binding[] {
        return [];
    }
}

let instance: JsCucumberProvider | null = null;

export function getJsCucumberProvider(): JsCucumberProvider {
    if (!instance) {
        instance = new JsCucumberProvider();
    }
    return instance;
}
