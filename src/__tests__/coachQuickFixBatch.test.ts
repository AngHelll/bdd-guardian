import { describe, it, expect } from 'vitest';
import { computeCoachQuickFixInserts } from '../features/coach/quickFixBatch';

describe('computeCoachQuickFixInserts', () => {
    it('inserts Examples template for coach/outline-examples before next block', () => {
        const text = [
            'Feature: Demo',
            '',
            '  Scenario Outline: Missing examples',
            '    Given something',
            '',
            '  Scenario: Next scenario',
            '    Given ok',
            '',
        ].join('\n');

        const inserts = computeCoachQuickFixInserts(text, [
            { line: 2, ruleId: 'coach/outline-examples' },
        ]);

        expect(inserts).toHaveLength(1);
        expect(inserts[0].line).toBe(5);
        expect(inserts[0].newText).toContain('Examples:');
    });

    it('does not insert if Examples already exists below the scenario', () => {
        const text = [
            'Feature: Demo',
            '',
            '  Scenario Outline: Has examples',
            '    Given something',
            '    Examples:',
            '      | a |',
            '      | 1 |',
            '',
        ].join('\n');

        const inserts = computeCoachQuickFixInserts(text, [
            { line: 2, ruleId: 'coach/outline-examples' },
        ]);

        expect(inserts).toHaveLength(0);
    });
});

