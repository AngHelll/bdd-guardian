/**
 * Map CoachSeverity → VS Code DiagnosticSeverity (UI only).
 */

import * as vscode from 'vscode';
import type { CoachSeverity } from './rules/types';

export function toVSCodeSeverity(severity: CoachSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        case 'hint':
            return vscode.DiagnosticSeverity.Hint;
        case 'off':
            return vscode.DiagnosticSeverity.Hint; // Should never reach here
    }
}
