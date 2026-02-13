/**
 * Navigator - Handles navigation from Feature steps to C# bindings
 * Uses vscode.open command for proper back/forward history support.
 */

import * as vscode from 'vscode';
import { MatchCandidate, ResolveResult } from '../../core/domain';

/**
 * Navigate to a specific binding location.
 * Uses vscode.open command instead of openTextDocument to preserve navigation history.
 */
export async function navigateToBinding(candidate: MatchCandidate): Promise<void> {
    const uri = candidate.binding.uri;
    const position = new vscode.Position(candidate.binding.lineNumber, 0);
    
    await vscode.commands.executeCommand('vscode.open', uri, {
        selection: new vscode.Range(position, position),
        preview: true,
    });
}

/**
 * Navigate to a binding from a resolve result.
 * If multiple candidates exist and user interaction is needed, returns false.
 * Otherwise navigates directly and returns true.
 */
export async function navigateFromResolveResult(result: ResolveResult): Promise<boolean> {
    if (result.candidates.length === 0) {
        return false;
    }
    
    if (result.candidates.length === 1) {
        await navigateToBinding(result.candidates[0]);
        return true;
    }
    
    // Multiple candidates - caller should use QuickPick
    return false;
}

/**
 * Navigate to a binding location by URI and line number.
 * Convenience method for direct navigation.
 */
export async function navigateToLocation(uri: vscode.Uri, line: number): Promise<void> {
    const position = new vscode.Position(line, 0);
    
    await vscode.commands.executeCommand('vscode.open', uri, {
        selection: new vscode.Range(position, position),
        preview: true,
    });
}

/**
 * Reveal a location in the editor without navigating (peek).
 */
export async function peekLocation(uri: vscode.Uri, line: number): Promise<void> {
    const position = new vscode.Position(line, 0);
    const locations = [new vscode.Location(uri, position)];
    
    await vscode.commands.executeCommand(
        'editor.action.peekLocations',
        uri,
        position,
        locations,
        'peek'
    );
}
