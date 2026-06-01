/**
 * Matching-related settings (bddGuardian.matching.*)
 */

import * as vscode from 'vscode';

/**
 * When true, pick the highest-scoring binding even if multiple regexes match (legacy behavior).
 * Default false: Reqnroll-like strict ambiguity when ≥2 bindings match.
 */
export function getPreferSpecificBinding(): boolean {
    return vscode.workspace.getConfiguration('bddGuardian.matching').get('preferSpecificBinding', false);
}
