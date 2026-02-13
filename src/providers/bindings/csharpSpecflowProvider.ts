/**
 * C# SpecFlow Binding Provider (Stub)
 * 
 * Placeholder for future SpecFlow support.
 * SpecFlow is the predecessor to Reqnroll with similar syntax.
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
 * C# SpecFlow Binding Provider (Stub)
 */
export class CSharpSpecflowProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'csharp-specflow';
    public readonly displayName = 'C# SpecFlow';
    public readonly bindingFileExtensions = ['.cs'];
    public readonly bindingGlob = '**/*.cs';
    
    async detect(_workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        // TODO: Implement SpecFlow detection
        // Signals: PackageReference to SpecFlow, using TechTalk.SpecFlow
        return NOT_IMPLEMENTED_DETECTION;
    }
    
    async indexBindings(
        _files: readonly vscode.Uri[],
        _options?: BindingIndexOptions
    ): Promise<Binding[]> {
        // TODO: Implement SpecFlow binding parsing
        return [];
    }
    
    parseFile(
        _document: vscode.TextDocument,
        _options?: BindingIndexOptions
    ): Binding[] {
        return [];
    }
}

let instance: CSharpSpecflowProvider | null = null;

export function getCSharpSpecflowProvider(): CSharpSpecflowProvider {
    if (!instance) {
        instance = new CSharpSpecflowProvider();
    }
    return instance;
}
