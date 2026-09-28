/**
 * Literal cluster rule.
 * Steps that share every word except one closed token should be a parameter.
 */

import { findLiteralClusters } from '../../../core/reuse/closedStep';
import { CoachFinding, CoachRule, CoachSeverity, GherkinModel, GherkinStep } from './types';

export class LiteralClusterRule implements CoachRule {
    readonly id = 'coach/literal-cluster';
    readonly name = 'Closed Step Cluster';
    readonly description = 'Steps that differ by a single closed word should use a parameter.';
    readonly severity: CoachSeverity = 'hint';

    run(model: GherkinModel): CoachFinding[] {
        const steps: { step: GherkinStep; keyword: 'Given' | 'When' | 'Then' }[] = [];
        const push = (step: GherkinStep): void => {
            if (step.keywordResolved === 'Given' || step.keywordResolved === 'When' || step.keywordResolved === 'Then') {
                steps.push({ step, keyword: step.keywordResolved });
            }
        };
        if (model.background) {
            for (const step of model.background.steps) {
                push(step);
            }
        }
        for (const scenario of model.scenarios) {
            for (const step of scenario.steps) {
                push(step);
            }
        }

        const clusters = findLiteralClusters(
            steps.map(({ step, keyword }) => ({
                text: step.text,
                keyword,
                line: step.line,
            }))
        );

        return clusters.map((cluster): CoachFinding => {
            const shown = cluster.words.slice(0, 3).join(', ');
            const more = cluster.words.length > 3 ? ', …' : '';
            return {
                ruleId: this.id,
                message: `Closed steps differ by one word (${shown}${more}). Consider a parameter so the step can be reused.`,
                severity: this.severity,
                line: cluster.line,
                column: 0,
            };
        });
    }
}
