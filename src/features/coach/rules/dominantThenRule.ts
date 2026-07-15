/**
 * Dominant Then Rule
 * Scenarios should have a clear outcome: at least one Then, and not more than max.
 */

import { CoachRule, CoachFinding, GherkinModel, CoachSeverity, CoachConfig } from './types';

const DEFAULT_MAX = 1;

export class DominantThenRule implements CoachRule {
    readonly id = 'coach/dominant-then';
    readonly name = 'Dominant Then';
    readonly description =
        'Scenarios should have a clear Then outcome (at least one, and not more than the configured maximum).';
    readonly severity: CoachSeverity = 'warning';

    private readonly maxThen: number;

    constructor(maxThen: number = DEFAULT_MAX) {
        this.maxThen = Math.max(1, maxThen);
    }

    run(model: GherkinModel): CoachFinding[] {
        const findings: CoachFinding[] = [];

        for (const scenario of model.scenarios) {
            const thenSteps = scenario.steps.filter((s) => s.keywordResolved === 'Then');
            const count = thenSteps.length;

            if (count === 0) {
                findings.push({
                    ruleId: this.id,
                    message: `Scenario "${scenario.title}" has no Then step. Add a clear assertion of the outcome.`,
                    severity: 'warning',
                    line: scenario.line,
                    column: 0,
                });
                continue;
            }

            if (count > this.maxThen) {
                const extras = thenSteps.slice(this.maxThen);
                for (const step of extras) {
                    findings.push({
                        ruleId: this.id,
                        message: `Scenario "${scenario.title}" has ${count} Then steps (max: ${this.maxThen}). Prefer one dominant outcome.`,
                        severity: 'warning',
                        line: step.line,
                        column: 0,
                    });
                }
            }
        }

        return findings;
    }
}

export function createDominantThenRule(config?: CoachConfig): CoachRule {
    const max = config?.dominantThen?.max ?? DEFAULT_MAX;
    return new DominantThenRule(max);
}

export const dominantThenRule = createDominantThenRule();
