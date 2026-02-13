/**
 * Health Score Calculator
 * Calculates a BDD health score for the workspace based on Coach findings.
 * 
 * Score ranges:
 * - 90-100: Excellent (🟢)
 * - 70-89:  Good (🟡)
 * - 50-69:  Needs Attention (🟠)
 * - 0-49:   Critical (🔴)
 */

import * as vscode from 'vscode';

/** Penalty weights by severity */
const SEVERITY_WEIGHTS = {
    error: 10,
    warning: 5,
    info: 2,
    hint: 1,
    off: 0,
};

/** Health score result */
export interface HealthScoreResult {
    /** Score from 0-100 */
    score: number;
    /** Grade letter */
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    /** Grade emoji */
    emoji: string;
    /** Total files analyzed */
    filesAnalyzed: number;
    /** Total findings by severity */
    findings: {
        errors: number;
        warnings: number;
        infos: number;
        hints: number;
        total: number;
    };
    /** Breakdown by rule */
    ruleBreakdown: Map<string, number>;
    /** Suggested improvements */
    suggestions: string[];
}

/**
 * Calculate health score from Coach diagnostics.
 */
export function calculateHealthScore(
    diagnosticsByFile: Map<vscode.Uri, readonly vscode.Diagnostic[]>
): HealthScoreResult {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    let hints = 0;
    const ruleBreakdown = new Map<string, number>();
    
    for (const diagnostics of diagnosticsByFile.values()) {
        for (const d of diagnostics) {
            const ruleId = String(d.code ?? 'unknown');
            ruleBreakdown.set(ruleId, (ruleBreakdown.get(ruleId) ?? 0) + 1);
            
            switch (d.severity) {
                case vscode.DiagnosticSeverity.Error:
                    errors++;
                    break;
                case vscode.DiagnosticSeverity.Warning:
                    warnings++;
                    break;
                case vscode.DiagnosticSeverity.Information:
                    infos++;
                    break;
                case vscode.DiagnosticSeverity.Hint:
                    hints++;
                    break;
            }
        }
    }
    
    const total = errors + warnings + infos + hints;
    const filesAnalyzed = diagnosticsByFile.size;
    
    // Calculate penalty
    const penalty = 
        errors * SEVERITY_WEIGHTS.error +
        warnings * SEVERITY_WEIGHTS.warning +
        infos * SEVERITY_WEIGHTS.info +
        hints * SEVERITY_WEIGHTS.hint;
    
    // Score: Start at 100, reduce by penalty (normalized by file count)
    const normalizedPenalty = filesAnalyzed > 0 
        ? penalty / Math.max(filesAnalyzed, 1)
        : 0;
    
    const rawScore = Math.max(0, 100 - normalizedPenalty * 5);
    const score = Math.round(rawScore);
    
    // Determine grade
    const { grade, emoji } = getGrade(score);
    
    // Generate suggestions
    const suggestions = generateSuggestions(ruleBreakdown, errors, warnings);
    
    return {
        score,
        grade,
        emoji,
        filesAnalyzed,
        findings: {
            errors,
            warnings,
            infos,
            hints,
            total,
        },
        ruleBreakdown,
        suggestions,
    };
}

/**
 * Get grade and emoji from score.
 */
function getGrade(score: number): { grade: 'A' | 'B' | 'C' | 'D' | 'F'; emoji: string } {
    if (score >= 90) return { grade: 'A', emoji: '🟢' };
    if (score >= 70) return { grade: 'B', emoji: '🟡' };
    if (score >= 50) return { grade: 'C', emoji: '🟠' };
    if (score >= 30) return { grade: 'D', emoji: '🔴' };
    return { grade: 'F', emoji: '⛔' };
}

/**
 * Generate improvement suggestions based on findings.
 */
function generateSuggestions(
    ruleBreakdown: Map<string, number>,
    errors: number,
    warnings: number
): string[] {
    const suggestions: string[] = [];
    
    // Sort rules by occurrence count
    const sortedRules = [...ruleBreakdown.entries()]
        .sort((a, b) => b[1] - a[1]);
    
    // Top 3 most violated rules
    for (const [ruleId, count] of sortedRules.slice(0, 3)) {
        if (count >= 3) {
            suggestions.push(getSuggestionForRule(ruleId, count));
        }
    }
    
    // General suggestions based on error/warning count
    if (errors > 0) {
        suggestions.push(`🔴 Fix ${errors} error(s) first - these indicate critical BDD issues.`);
    }
    
    if (warnings > 5) {
        suggestions.push(`🟠 Address ${warnings} warnings to improve code quality.`);
    }
    
    if (suggestions.length === 0) {
        suggestions.push('✨ Your BDD specs look great! Keep up the good work.');
    }
    
    return suggestions;
}

/**
 * Get specific suggestion for a rule.
 */
function getSuggestionForRule(ruleId: string, count: number): string {
    switch (ruleId) {
        case 'coach/scenario-name':
            return `📝 ${count} scenarios have vague names. Use descriptive, business-focused titles.`;
        case 'coach/gwt-structure':
            return `📋 ${count} scenarios have incorrect GWT order. Follow Given → When → Then structure.`;
        case 'coach/step-length':
            return `✂️ ${count} steps are too long. Keep steps concise and focused.`;
        case 'coach/ui-leakage':
            return `🎨 ${count} steps leak UI details. Describe behavior, not implementation.`;
        case 'coach/outline-examples':
            return `📊 ${count} Scenario Outlines lack examples. Add data-driven test cases.`;
        case 'coach/duplicate-steps':
            return `🔄 ${count} duplicate steps found. Consider using Background or parameterized steps.`;
        case 'coach/vague-then':
            return `❓ ${count} Then steps are vague. Assert specific, observable outcomes.`;
        case 'coach/too-many-steps':
            return `📏 ${count} scenarios are too long. Split into smaller, focused scenarios.`;
        default:
            return `⚠️ ${count} violations of ${ruleId}. Review and fix.`;
    }
}

/**
 * Format health score as a markdown report.
 */
export function formatHealthReport(result: HealthScoreResult): string {
    const lines: string[] = [
        '# 🏥 BDD Health Report',
        '',
        `## Score: ${result.emoji} ${result.score}/100 (Grade: ${result.grade})`,
        '',
        '### Summary',
        `- **Files Analyzed:** ${result.filesAnalyzed}`,
        `- **Total Findings:** ${result.findings.total}`,
        `  - 🔴 Errors: ${result.findings.errors}`,
        `  - 🟠 Warnings: ${result.findings.warnings}`,
        `  - 🔵 Info: ${result.findings.infos}`,
        `  - ⚪ Hints: ${result.findings.hints}`,
        '',
    ];
    
    if (result.ruleBreakdown.size > 0) {
        lines.push('### Findings by Rule');
        const sortedRules = [...result.ruleBreakdown.entries()]
            .sort((a, b) => b[1] - a[1]);
        
        for (const [ruleId, count] of sortedRules) {
            lines.push(`- \`${ruleId}\`: ${count}`);
        }
        lines.push('');
    }
    
    if (result.suggestions.length > 0) {
        lines.push('### 💡 Suggestions');
        for (const suggestion of result.suggestions) {
            lines.push(`- ${suggestion}`);
        }
        lines.push('');
    }
    
    return lines.join('\n');
}
