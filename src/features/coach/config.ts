/**
 * Coach Configuration
 * Reads Coach settings from VS Code configuration.
 */

import * as vscode from 'vscode';
import { CoachConfig, CoachSeverity } from './rules/types';

/**
 * Get the Coach configuration from VS Code settings.
 */
export function getCoachConfig(): CoachConfig {
    const config = vscode.workspace.getConfiguration('bddGuardian.coach');
    
    // Parse severity overrides
    const rawOverrides = config.get<Record<string, string>>('severityOverrides', {});
    const severityOverrides: Record<string, CoachSeverity> = {};
    
    for (const [ruleId, severity] of Object.entries(rawOverrides)) {
        if (isValidSeverity(severity)) {
            severityOverrides[ruleId] = severity;
        }
    }
    
    // Parse UI leakage keywords
    const uiKeywords = config.get<string[]>('uiLeakage.keywords');
    
    // Parse step length max
    const stepLengthMax = config.get<number>('stepLength.max', 120);
    
    // Parse disabled rules
    const disabled = config.get<string[]>('disabled', []);
    
    const result: CoachConfig = {
        severityOverrides,
        disabled,
        stepLength: { max: stepLengthMax },
    };
    
    // Only add uiLeakage if keywords are provided
    if (uiKeywords && uiKeywords.length > 0) {
        result.uiLeakage = { keywords: uiKeywords };
    }
    
    return result;
}

function isValidSeverity(value: string): value is CoachSeverity {
    return ['error', 'warning', 'hint', 'info', 'off'].includes(value);
}

/**
 * Check if Coach is enabled.
 */
export function isCoachEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('bddGuardian.coach');
    return config.get<boolean>('enabled', false);
}

/**
 * Check if status bar is enabled.
 */
export function isStatusBarEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('bddGuardian.coach');
    return config.get<boolean>('statusBar.enabled', true);
}
