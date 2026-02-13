/**
 * Navigation Helper
 * Provides consistent navigation behavior across the extension
 * 
 * WHY vscode.open INSTEAD OF openTextDocument + showTextDocument:
 * ---------------------------------------------------------------
 * Using openTextDocument + showTextDocument does not properly integrate
 * with VS Code's editor navigation history. This causes the back/forward
 * commands (Ctrl+Alt+-/+) to return to the wrong position in the document.
 * 
 * By using `vscode.commands.executeCommand('vscode.open', ...)` with a
 * selection option, VS Code correctly records the navigation in its
 * history stack, allowing proper back/forward navigation.
 */

import * as vscode from 'vscode';

/**
 * Navigate to a specific location in a file.
 * Uses vscode.open command to ensure proper history tracking for back/forward navigation.
 * 
 * @param uri - The URI of the file to open
 * @param range - The range to select/navigate to
 * @param options - Optional navigation options
 */
export async function navigateToLocation(
    uri: vscode.Uri,
    range: vscode.Range,
    options?: {
        /** If true, keeps focus on the current editor (default: false) */
        preserveFocus?: boolean;
        /** If true, opens in preview mode (default: false for navigation) */
        preview?: boolean;
    }
): Promise<void> {
    const { preserveFocus = false, preview = false } = options || {};

    // Create selection at the start of the range
    const selection = new vscode.Range(range.start, range.start);

    // Use vscode.open command for proper history tracking
    // This ensures back/forward navigation works correctly
    await vscode.commands.executeCommand('vscode.open', uri, {
        selection,
        preserveFocus,
        preview,
    });

    // After opening, ensure the line is visible if it's outside the viewport
    // Using InCenterIfOutsideViewport to avoid unnecessary scrolling
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri.toString()) {
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
}

/**
 * Navigate to a Location (uri + range)
 * Convenience wrapper for navigateToLocation
 */
export async function navigateToDefinition(location: vscode.Location): Promise<void> {
    await navigateToLocation(location.uri, location.range);
}
