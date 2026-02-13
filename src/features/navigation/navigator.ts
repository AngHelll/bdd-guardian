/**
 * Navigator - Handles navigation from Feature steps to C# bindings
 * 
 * Phase 2: Now integrates with NavigationHistory for back/forward support.
 */

import * as vscode from 'vscode';
import { MatchCandidate, ResolveResult } from '../../core/domain';
import { getNavigationHistory } from './navigationHistory';

/**
 * Navigate to a specific binding location.
 * Records current position in history before navigating.
 */
export async function navigateToBinding(candidate: MatchCandidate): Promise<void> {
    const history = getNavigationHistory();
    
    // Record current position before navigating
    history.recordCurrentPosition();
    
    const uri = candidate.binding.uri;
    const position = new vscode.Position(candidate.binding.lineNumber, 0);
    
    await vscode.commands.executeCommand('vscode.open', uri, {
        selection: new vscode.Range(position, position),
        preview: false, // Don't use preview to ensure proper history
    });
    
    // Record the destination
    history.push({
        uri,
        line: candidate.binding.lineNumber,
        character: 0,
        type: 'binding',
        label: candidate.binding.methodName,
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
 * Records current position in history before navigating.
 */
export async function navigateToLocation(
    uri: vscode.Uri, 
    line: number,
    label?: string
): Promise<void> {
    const history = getNavigationHistory();
    
    // Record current position before navigating
    history.recordCurrentPosition();
    
    const position = new vscode.Position(line, 0);
    
    await vscode.commands.executeCommand('vscode.open', uri, {
        selection: new vscode.Range(position, position),
        preview: false,
    });
    
    // Record the destination
    const type = uri.fsPath.endsWith('.feature') ? 'feature' : 'binding';
    history.push({
        uri,
        line,
        character: 0,
        type,
        label,
    });
}

/**
 * Reveal a location in the editor without navigating (peek).
 * Does not affect navigation history.
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
