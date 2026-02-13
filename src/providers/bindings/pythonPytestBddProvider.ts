/**
 * Python pytest-bdd Binding Provider (Stub)
 * 
 * Placeholder for future pytest-bdd support.
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
 * Python pytest-bdd Binding Provider (Stub)
 */
export class PythonPytestBddProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'python-pytestbdd';
    public readonly displayName = 'Python pytest-bdd';
    public readonly bindingFileExtensions = ['.py'];
    public readonly bindingGlob = '**/*.py';
    
    async detect(_workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        // TODO: Implement pytest-bdd detection
        // Signals: pytest-bdd in requirements.txt, @given/@when/@then from pytest_bdd
        return NOT_IMPLEMENTED_DETECTION;
    }
    
    async indexBindings(
        _files: readonly vscode.Uri[],
        _options?: BindingIndexOptions
    ): Promise<Binding[]> {
        // TODO: Implement pytest-bdd binding parsing
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

let instance: PythonPytestBddProvider | null = null;

export function getPythonPytestBddProvider(): PythonPytestBddProvider {
    if (!instance) {
        instance = new PythonPytestBddProvider();
    }
    return instance;
}
