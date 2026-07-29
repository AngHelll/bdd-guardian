import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { loadProject } from '../cli/loadProject';
import { buildResolveStepReport } from '../cli/resolveStep';
import { runCli } from '../cli/main';

const BINDING_DEMO = join(__dirname, '../../samples/binding-demo');
const FEATURE = 'Features/sample.feature';

describe('guardian-cli resolve-step', () => {
    it('reports bound status for a known step line in binding-demo', () => {
        const project = loadProject(BINDING_DEMO);
        // Background: "Given the calculator is initialized" — line 7 in file → 0-based 7
        // File lines (1-based): 8 = Given the calculator... → 0-based line 7
        const report = buildResolveStepReport(project, FEATURE, 7);
        expect(report.schemaVersion).toBe(1);
        expect(report.status).toBe('bound');
        expect(report.stepText).toMatch(/calculator is initialized/i);
        expect(report.matches.length).toBeGreaterThan(0);
        expect(report.matches[0].methodName.length).toBeGreaterThan(0);
        expect(report.why).toBeNull();
    });

    it('reports no_step for a blank / non-step line', () => {
        const project = loadProject(BINDING_DEMO);
        const report = buildResolveStepReport(project, FEATURE, 0);
        expect(report.status).toBe('no_step');
        expect(report.stepText).toBeNull();
        expect(report.matches).toEqual([]);
    });

    it('runCli resolve-step prints JSON exit 0', () => {
        const logs: string[] = [];
        const prevLog = console.log;
        console.log = (msg?: unknown) => {
            logs.push(String(msg));
        };
        try {
            expect(runCli(['resolve-step', BINDING_DEMO, FEATURE, '7'])).toBe(0);
            const parsed = JSON.parse(logs.join('\n'));
            expect(parsed.status).toBe('bound');
        } finally {
            console.log = prevLog;
        }
    });
});
