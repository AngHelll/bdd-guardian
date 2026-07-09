/**
 * Step Status Module - Single source of truth for step binding state.
 * 
 * All UI elements (gutter icons, hover, CodeLens, QuickPick) use this module
 * to ensure consistent status representation across the extension.
 */

import * as vscode from 'vscode';
import { MatchCandidate, ResolvedKeyword, ResolveResult } from '../core/domain';
import { t } from '../i18n';

/**
 * Step binding status enum.
 */
export enum StepStatus {
    Bound = 'bound',
    Unbound = 'unbound',
    Ambiguous = 'ambiguous',
    Indexing = 'indexing',
}

/**
 * Step status information with full context.
 */
export interface StepStatusInfo {
    status: StepStatus;
    candidates: readonly MatchCandidate[];
    best: MatchCandidate | null;
    stepText: string;
    resolvedKeyword: ResolvedKeyword;
}

/**
 * UI configuration from VS Code settings.
 */
export interface UIConfig {
    gutterIconsEnabled: boolean;
    hoverDetailsEnabled: boolean;
    decorationsEnabled: boolean;
    codeLensEnabled: boolean;
    diagnosticsEnabled: boolean;
    showMatchScore: boolean;
}

/**
 * Get UI configuration from VS Code settings.
 */
export function getUIConfig(): UIConfig {
    const config = vscode.workspace.getConfiguration('bddGuardian');
    const legacyConfig = vscode.workspace.getConfiguration('reqnrollNavigator');
    
    return {
        gutterIconsEnabled: config.get<boolean>('gutterIcons.enabled', true),
        hoverDetailsEnabled: config.get<boolean>('hoverDetails.enabled', true),
        decorationsEnabled: legacyConfig.get<boolean>('enableDecorations', true),
        codeLensEnabled: legacyConfig.get<boolean>('enableCodeLens', true),
        diagnosticsEnabled: legacyConfig.get<boolean>('enableDiagnostics', true),
        showMatchScore: config.get<boolean>('ui.showMatchScore', false),
    };
}

/**
 * Convert ResolveResult to StepStatusInfo.
 */
export function getStepStatusFromResult(
    result: ResolveResult,
    stepText: string,
    resolvedKeyword: ResolvedKeyword
): StepStatusInfo {
    return {
        status: result.status as StepStatus,
        candidates: result.candidates,
        best: result.best ?? null,
        stepText,
        resolvedKeyword,
    };
}

/**
 * Get ThemeIcon for a step status.
 */
export function getStatusIcon(status: StepStatus): vscode.ThemeIcon {
    switch (status) {
        case StepStatus.Bound:
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        case StepStatus.Ambiguous:
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        case StepStatus.Unbound:
            return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        case StepStatus.Indexing:
            return new vscode.ThemeIcon('sync~spin');
        default:
            return new vscode.ThemeIcon('question');
    }
}

/**
 * Get status label for display.
 */
export function getStatusLabel(status: StepStatus): string {
    switch (status) {
        case StepStatus.Bound:
            return t('statusBound');
        case StepStatus.Ambiguous:
            return t('statusAmbiguous');
        case StepStatus.Unbound:
            return t('statusUnbound');
        case StepStatus.Indexing:
            return t('statusIndexingLabel');
        default:
            return t('statusUnknown');
    }
}

/**
 * Gutter hover label for ambiguous steps including match count.
 */
export function getAmbiguousStatusLabel(candidateCount: number): string {
    return t('statusAmbiguousWithCount', String(candidateCount));
}

/**
 * Format bound step CodeLens title (optionally with debug match score).
 */
export function formatBoundCodeLensTitle(
    className: string,
    methodName: string,
    score: number,
    showMatchScore: boolean
): string {
    const binding = `${className}.${methodName}`;
    return showMatchScore ? `${binding} (${score})` : binding;
}

/**
 * Codicon for CodeLens titles (aligned with gutter semantics — see docs/VISUAL_LANGUAGE.md).
 */
export function getCodeLensIcon(status: StepStatus): string {
    switch (status) {
        case StepStatus.Bound:
            return '$(check)';
        case StepStatus.Ambiguous:
            return '$(warning)';
        case StepStatus.Unbound:
            return '$(error)';
        case StepStatus.Indexing:
            return '$(sync~spin)';
        default:
            return '$(question)';
    }
}

/**
 * Map resolver status string to StepStatus.
 */
export function stepStatusFromResolve(status: string): StepStatus {
    if (status === 'unbound') {
        return StepStatus.Unbound;
    }
    if (status === 'ambiguous') {
        return StepStatus.Ambiguous;
    }
    if (status === 'indexing') {
        return StepStatus.Indexing;
    }
    return StepStatus.Bound;
}

/**
 * Get status emoji for markdown.
 */
export function getStatusEmoji(status: StepStatus): string {
    switch (status) {
        case StepStatus.Bound:
            return '✅';
        case StepStatus.Ambiguous:
            return '⚠️';
        case StepStatus.Unbound:
            return '❌';
        case StepStatus.Indexing:
            return '⏳';
        default:
            return '❓';
    }
}

/**
 * Get color for status (for decorations).
 */
export function getStatusColor(status: StepStatus): string {
    switch (status) {
        case StepStatus.Bound:
            return 'charts.green';
        case StepStatus.Ambiguous:
            return 'charts.yellow';
        case StepStatus.Unbound:
            return 'charts.red';
        default:
            return 'foreground';
    }
}

/**
 * Format binding for display.
 */
export function formatBinding(candidate: MatchCandidate, includeFile = false): string {
    const binding = candidate.binding;
    const methodDisplay = `${binding.className}.${binding.methodName}`;
    
    if (includeFile) {
        const relativePath = vscode.workspace.asRelativePath(binding.uri);
        return `${methodDisplay} — ${relativePath}:${binding.lineNumber + 1}`;
    }
    
    return methodDisplay;
}

/**
 * Sort candidates by score (best first).
 */
export function sortCandidatesByScore(candidates: readonly MatchCandidate[]): MatchCandidate[] {
    return [...candidates].sort((a, b) => b.score - a.score);
}
