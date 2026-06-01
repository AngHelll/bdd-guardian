/**
 * Definition Provider - Implements Go to Definition for Gherkin steps.
 */

import * as vscode from 'vscode';
import { IndexManager } from '../../core/index';
import { createResolver, applyMatchingSettings, ResolverDependencies } from '../../core/matching';
import { getStepAtPosition } from '../../core/references/stepContext';
import { FEATURE_DOCUMENT_SELECTORS } from './documentSelectors';

export class DefinitionProvider implements vscode.DefinitionProvider {
    constructor(private indexManager: IndexManager) {}
    
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | null> {
        if (!document.fileName.endsWith('.feature')) {
            return null;
        }

        const step = getStepAtPosition(document, position);
        if (!step) {
            return null;
        }
        
        const index = this.indexManager.getIndex();
        const allBindings = index.getAllBindings();
        
        if (allBindings.length === 0) {
            return null;
        }
        
        const deps: ResolverDependencies = {
            getAllBindings: () => allBindings,
            getBindingsByKeyword: (kw) => index.getBindingsByKeyword(kw),
        };
        
        const resolve = createResolver(applyMatchingSettings(deps));
        const result = resolve(step);
        
        if (result.candidates.length === 0) {
            return null;
        }
        
        return result.candidates.map(candidate => {
            return new vscode.Location(
                candidate.binding.uri,
                new vscode.Position(candidate.binding.lineNumber, 0)
            );
        });
    }
}

export function createDefinitionProvider(
    indexManager: IndexManager
): vscode.Disposable {
    const provider = new DefinitionProvider(indexManager);
    return vscode.languages.registerDefinitionProvider(FEATURE_DOCUMENT_SELECTORS, provider);
}
