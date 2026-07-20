import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { loadProject } from '../cli/loadProject';
import { buildDiscoverReport } from '../cli/discover';
import { buildAnalyzeReport } from '../cli/analyze';
import { runCli, USAGE } from '../cli/main';

const BINDING_DEMO = join(__dirname, '../../samples/binding-demo');

describe('guardian-cli', () => {
    it('loadProject indexes features and csharp bindings in binding-demo', () => {
        const project = loadProject(BINDING_DEMO);
        expect(project.features.length).toBeGreaterThan(0);
        expect(project.bindings.length).toBeGreaterThan(0);
        expect(project.providersDetected).toContain('csharp-reqnroll');
    });

    it('buildDiscoverReport exposes schemaVersion and paths', () => {
        const report = buildDiscoverReport(loadProject(BINDING_DEMO));
        expect(report.schemaVersion).toBe(1);
        expect(report.features.some((f) => f.path.endsWith('.feature'))).toBe(true);
        expect(report.bindings.some((b) => b.pattern.length > 0)).toBe(true);
        expect(report.providersDetected).toContain('csharp-reqnroll');
    });

    it('buildAnalyzeReport counts bound steps in binding-demo', () => {
        const report = buildAnalyzeReport(loadProject(BINDING_DEMO), { maxItems: 10 });
        expect(report.schemaVersion).toBe(1);
        expect(report.counts.features).toBeGreaterThan(0);
        expect(report.counts.bindings).toBeGreaterThan(0);
        expect(report.counts.bound).toBeGreaterThan(0);
        expect(report.counts.steps).toBe(
            report.counts.bound + report.counts.unbound + report.counts.ambiguous
        );
        expect(report.unbound.length).toBeLessThanOrEqual(10);
        expect(report.ambiguous.length).toBeLessThanOrEqual(10);
    });

    it('runCli usage without args returns 2', () => {
        const prevErr = console.error;
        console.error = () => {};
        try {
            expect(runCli([])).toBe(2);
            expect(USAGE).toContain('discover');
        } finally {
            console.error = prevErr;
        }
    });

    it('runCli analyze on binding-demo returns 0 and prints JSON', () => {
        const logs: string[] = [];
        const prevLog = console.log;
        console.log = (msg?: unknown) => {
            logs.push(String(msg));
        };
        try {
            expect(runCli(['analyze', BINDING_DEMO, '--max-items', '5'])).toBe(0);
            const parsed = JSON.parse(logs.join('\n'));
            expect(parsed.counts.bound).toBeGreaterThan(0);
        } finally {
            console.log = prevLog;
        }
    });
});
