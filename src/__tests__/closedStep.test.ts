import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { loadProject } from '../cli/loadProject';
import { dispatchMcpTool } from '../cli/mcpTools';
import { buildVocabularyReport } from '../cli/vocabulary';
import { runCli } from '../cli/main';
import { suggestClosedStep } from '../core/reuse/closedStep';
import type { ReuseBindingSource } from '../core/reuse/suggestReuse';

const BINDING_DEMO = join(__dirname, '../../samples/binding-demo');

function source(
    partial: Partial<ReuseBindingSource> & Pick<ReuseBindingSource, 'patternRaw' | 'keyword'>
): ReuseBindingSource {
    return {
        methodName: partial.methodName ?? 'Step',
        filePath: partial.filePath ?? 'Steps.cs',
        line: partial.line ?? 0,
        patternRaw: partial.patternRaw,
        keyword: partial.keyword,
    };
}

describe('suggestClosedStep', () => {
    it('points a closed word at an existing parameter slot', () => {
        const result = suggestClosedStep('I press Submit', 'When', [
            source({
                patternRaw: 'I press "(.*)"',
                keyword: 'When',
                methodName: 'WhenIPress',
            }),
        ]);
        expect(result.kind).toBe('useSlot');
        if (result.kind !== 'useSlot') {
            return;
        }
        expect(result.word).toBe('submit');
        expect(result.humanized.toLowerCase()).toContain('press');
    });

    it('asks to parameterize when the sibling binding is also literal', () => {
        const result = suggestClosedStep('I press Submit', 'When', [
            source({ patternRaw: 'I press Cancel', keyword: 'When', methodName: 'PressCancel' }),
        ]);
        expect(result.kind).toBe('parameterize');
        if (result.kind !== 'parameterize') {
            return;
        }
        expect(result.word).toBe('submit');
        expect(result.methodName).toBe('PressCancel');
    });

    it('stays silent when two literals are equally close', () => {
        const result = suggestClosedStep('I press Submit', 'When', [
            source({ patternRaw: 'I press Cancel', keyword: 'When', methodName: 'A' }),
            source({ patternRaw: 'I press Reject', keyword: 'When', methodName: 'B' }),
        ]);
        expect(result).toEqual({ kind: 'none' });
    });
});

describe('vocabulary CLI / MCP', () => {
    it('lists humanized bindings from binding-demo', () => {
        const project = loadProject(BINDING_DEMO);
        const report = buildVocabularyReport(project, { maxItems: 50 });
        expect(report.schemaVersion).toBe(1);
        expect(report.count).toBeGreaterThan(0);
        expect(report.steps.length).toBeLessThanOrEqual(report.count);
        const press = report.steps.find((row) => row.methodName === 'WhenIPress');
        expect(press?.keyword).toBe('When');
        expect(press?.parameterized).toBe(true);
        expect(press?.path).toMatch(/StepDefinitions\//);
        expect(press?.humanized.toLowerCase()).toContain('press');
    });

    it('filters by keyword and caps rows without shrinking count', () => {
        const project = loadProject(BINDING_DEMO);
        const report = buildVocabularyReport(project, { maxItems: 1, keyword: 'When' });
        expect(report.steps).toHaveLength(1);
        expect(report.count).toBeGreaterThan(1);
        expect(report.steps[0].keyword).toBe('When');
    });

    it('dispatchMcpTool matches the report', () => {
        const report = dispatchMcpTool('guardian_vocabulary', {
            projectDir: BINDING_DEMO,
            keyword: 'Given',
            maxItems: 5,
        }) as { count: number; steps: { keyword: string }[] };
        expect(report.count).toBeGreaterThan(0);
        expect(report.steps.every((row) => row.keyword === 'Given')).toBe(true);
    });

    it('runCli vocabulary prints JSON', () => {
        const logs: string[] = [];
        const prev = console.log;
        console.log = (msg?: unknown) => {
            logs.push(String(msg));
        };
        try {
            expect(runCli(['vocabulary', BINDING_DEMO, '--keyword', 'When', '--max-items', '2'])).toBe(0);
            const parsed = JSON.parse(logs.join('\n')) as { steps: unknown[]; count: number };
            expect(parsed.steps).toHaveLength(2);
            expect(parsed.count).toBeGreaterThanOrEqual(2);
        } finally {
            console.log = prev;
        }
    });
});
