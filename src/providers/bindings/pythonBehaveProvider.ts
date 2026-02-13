/**
 * Python Behave Binding Provider (Stub)
 * 
 * Placeholder for future Behave support.
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
 * Python Behave Binding Provider (Stub)
 */
export class PythonBehaveProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'python-behave';
    public readonly displayName = 'Python Behave';
    public readonly bindingFileExtensions = ['.py'];
    public readonly bindingGlob = '**/*.py';
    
    async detect(_workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        // TODO: Implement Behave detection
        // Signals: behave in requirements.txt/setup.py, @given/@when/@then decorators
        return NOT_IMPLEMENTED_DETECTION;
    }
    
    async indexBindings(
        _files: readonly vscode.Uri[],
        _options?: BindingIndexOptions
    ): Promise<Binding[]> {
        // TODO: Implement Behave binding parsing
        // Look for: @given('pattern'), @when('pattern'), @then('pattern')
        return [];
    }
    
    parseFile(
        _document: vscode.TextDocument,
        _options?: BindingIndexOptions
    ): Binding[] {
        return [];
    }
}

let instance: PythonBehaveProvider | null = null;

export function getPythonBehaveProvider(): PythonBehaveProvider {
    if (!instance) {
        instance = new PythonBehaveProvider();
    }
    return instance;
}
