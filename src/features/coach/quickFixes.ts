/**
 * Coach Quick Fixes Provider
 * Provides code actions for Coach findings.
 * 
 * v2: Added Health Score command
 */

import * as vscode from 'vscode';
import { CoachDiagnosticsProvider } from './coachDiagnostics';
import { calculateHealthScore, formatHealthReport } from './healthScore';
import { getAllRuleInfo } from './rules';

export class CoachQuickFixProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];
    
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        
        // Filter for Coach diagnostics
        const coachDiagnostics = context.diagnostics.filter(
            d => d.source === CoachDiagnosticsProvider.SOURCE
        );
        
        for (const diagnostic of coachDiagnostics) {
            // Create "Disable this rule" action
            const disableAction = this.createDisableRuleAction(diagnostic);
            if (disableAction) {
                actions.push(disableAction);
            }
            
            // Create "Ignore this line" action (via comment)
            const ignoreAction = this.createIgnoreLineAction(document, diagnostic);
            if (ignoreAction) {
                actions.push(ignoreAction);
            }
        }
        
        return actions;
    }
    
    private createDisableRuleAction(diagnostic: vscode.Diagnostic): vscode.CodeAction | undefined {
        const ruleId = diagnostic.code as string | undefined;
        if (!ruleId) {
            return undefined;
        }
        
        const action = new vscode.CodeAction(
            `Disable Coach rule: ${ruleId}`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.command = {
            command: 'bddGuardian.coach.disableRule',
            title: 'Disable Rule',
            arguments: [ruleId],
        };
        
        action.isPreferred = false;
        
        return action;
    }
    
    private createIgnoreLineAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const ruleId = diagnostic.code as string | undefined;
        if (!ruleId) {
            return undefined;
        }
        
        const action = new vscode.CodeAction(
            `Ignore this line (coach-ignore)`,
            vscode.CodeActionKind.QuickFix
        );
        
        // Add a comment above the line
        const line = diagnostic.range.start.line;
        const lineText = document.lineAt(line).text;
        const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
        
        const edit = new vscode.WorkspaceEdit();
        edit.insert(
            document.uri,
            new vscode.Position(line, 0),
            `${indent}# coach-ignore: ${ruleId}\n`
        );
        
        action.edit = edit;
        action.isPreferred = false;
        
        return action;
    }
}

/**
 * Register Coach commands.
 */
export function registerCoachCommands(context: vscode.ExtensionContext): void {
    // Toggle Coach
    context.subscriptions.push(
        vscode.commands.registerCommand('bddGuardian.coach.toggle', async () => {
            const config = vscode.workspace.getConfiguration('bddGuardian.coach');
            const current = config.get<boolean>('enabled', false);
            await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
            
            const status = !current ? 'enabled' : 'disabled';
            vscode.window.showInformationMessage(`BDD Coach ${status}`);
        })
    );
    
    // Disable rule
    context.subscriptions.push(
        vscode.commands.registerCommand('bddGuardian.coach.disableRule', async (ruleId: string) => {
            const config = vscode.workspace.getConfiguration('bddGuardian.coach');
            const overrides = config.get<Record<string, string>>('severityOverrides', {});
            
            overrides[ruleId] = 'off';
            await config.update('severityOverrides', overrides, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Disabled Coach rule: ${ruleId}`);
        })
    );
    
    // Show all rules
    context.subscriptions.push(
        vscode.commands.registerCommand('bddGuardian.coach.showRules', async () => {
            const rules = getAllRuleInfo();
            
            const items = rules.map(r => ({
                label: r.name,
                description: r.id,
                detail: r.description,
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                title: 'BDD Coach Rules (v2: 8 rules)',
                placeHolder: 'Select a rule to view documentation',
            });
            
            if (selected) {
                vscode.window.showInformationMessage(`${selected.label}: ${selected.detail}`);
            }
        })
    );
    
    // Show Health Score (NEW in v2)
    context.subscriptions.push(
        vscode.commands.registerCommand('bddGuardian.coach.showHealthScore', async () => {
            // Collect all Coach diagnostics
            const diagnosticsByFile = new Map<vscode.Uri, readonly vscode.Diagnostic[]>();
            
            // Get diagnostics from all feature files
            for (const doc of vscode.workspace.textDocuments) {
                if (doc.languageId === 'feature' || doc.fileName.endsWith('.feature')) {
                    const diagnostics = vscode.languages.getDiagnostics(doc.uri)
                        .filter(d => d.source === CoachDiagnosticsProvider.SOURCE);
                    
                    if (diagnostics.length > 0) {
                        diagnosticsByFile.set(doc.uri, diagnostics);
                    }
                }
            }
            
            // Also scan workspace for feature files not currently open
            const featureFiles = await vscode.workspace.findFiles('**/*.feature', '**/node_modules/**');
            
            for (const uri of featureFiles) {
                if (!diagnosticsByFile.has(uri)) {
                    const diagnostics = vscode.languages.getDiagnostics(uri)
                        .filter(d => d.source === CoachDiagnosticsProvider.SOURCE);
                    
                    if (diagnostics.length > 0) {
                        diagnosticsByFile.set(uri, diagnostics);
                    }
                }
            }
            
            // Calculate health score
            const result = calculateHealthScore(diagnosticsByFile);
            
            // Format and show report
            const report = formatHealthReport(result);
            
            // Show in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown',
            });
            
            await vscode.window.showTextDocument(doc, { preview: true });
            
            // Also show a quick notification
            vscode.window.showInformationMessage(
                `BDD Health Score: ${result.emoji} ${result.score}/100 (Grade: ${result.grade})`
            );
        })
    );
}
