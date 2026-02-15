/**
 * QuickPick for selecting from multiple binding candidates.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MatchCandidate, ResolveResult } from '../../core/domain';
import { navigateToBinding } from './navigator';
import { t } from '../../i18n';

interface BindingQuickPickItem extends vscode.QuickPickItem {
    candidate: MatchCandidate;
}

/**
 * Format a binding candidate as a QuickPickItem.
 */
function formatCandidateItem(candidate: MatchCandidate): BindingQuickPickItem {
    const binding = candidate.binding;
    const fileName = path.basename(binding.uri.fsPath);
    const dirName = path.dirname(binding.uri.fsPath).split(path.sep).slice(-2).join(path.sep);
    
    return {
        label: `$(symbol-method) ${binding.methodName}`,
        description: `${fileName}:${binding.lineNumber + 1}`,
        detail: `${dirName} • Score: ${candidate.score} • Pattern: ${binding.patternRaw}`,
        candidate,
    };
}

/**
 * Show QuickPick for multiple binding candidates and navigate to selected.
 * Returns true if user selected an item, false if cancelled.
 */
export async function showBindingQuickPick(
    result: ResolveResult,
    title?: string
): Promise<boolean> {
    if (result.candidates.length === 0) {
        vscode.window.showWarningMessage(t('noBindingsForStep', result.step.rawText));
        return false;
    }
    
    if (result.candidates.length === 1) {
        await navigateToBinding(result.candidates[0]);
        return true;
    }
    
    // Sort by score descending
    const sortedCandidates = [...result.candidates].sort((a, b) => b.score - a.score);
    const items = sortedCandidates.map(formatCandidateItem);
    
    const selected = await vscode.window.showQuickPick(items, {
        title: title ?? `Select binding for: "${result.step.rawText}"`,
        placeHolder: 'Choose a binding to navigate to',
        matchOnDescription: true,
        matchOnDetail: true,
    });
    
    if (selected) {
        await navigateToBinding(selected.candidate);
        return true;
    }
    
    return false;
}

/**
 * Show QuickPick for all bindings in the workspace.
 * Useful for "Go to Binding" command.
 */
export async function showAllBindingsQuickPick(
    candidates: MatchCandidate[],
    title?: string
): Promise<boolean> {
    if (candidates.length === 0) {
        vscode.window.showWarningMessage(t('noBindingsInWorkspace'));
        return false;
    }
    
    const items = candidates.map(formatCandidateItem);
    
    const selected = await vscode.window.showQuickPick(items, {
        title: title ?? 'All Step Bindings',
        placeHolder: 'Type to filter bindings...',
        matchOnDescription: true,
        matchOnDetail: true,
    });
    
    if (selected) {
        await navigateToBinding(selected.candidate);
        return true;
    }
    
    return false;
}
