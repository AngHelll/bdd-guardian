/**
 * Go Godog Binding Provider (Stub)
 * 
 * Placeholder for future Godog support.
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
 * Go Godog Binding Provider (Stub)
 */
export class GoGodogProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'go-godog';
    public readonly displayName = 'Go Godog';
    public readonly bindingFileExtensions = ['.go'];
    public readonly bindingGlob = '**/*.go';
    
    async detect(_workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        // TODO: Implement Godog detection
        // Signals: godog in go.mod, ctx.Step patterns
        return NOT_IMPLEMENTED_DETECTION;
    }
    
    async indexBindings(
        _files: readonly vscode.Uri[],
        _options?: BindingIndexOptions
    ): Promise<Binding[]> {
        // TODO: Implement Godog binding parsing
        // Look for: ctx.Step(`^pattern$`, handler)
        return [];
    }
    
    parseFile(
        _document: vscode.TextDocument,
        _options?: BindingIndexOptions
    ): Binding[] {
        return [];
    }
}

let instance: GoGodogProvider | null = null;

export function getGoGodogProvider(): GoGodogProvider {
    if (!instance) {
        instance = new GoGodogProvider();
    }
    return instance;
}
