import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { loadProject } from '../cli/loadProject';
import { buildCoachAnalyzeReport } from '../cli/coachAnalyze';
import { dispatchMcpTool, MCP_TOOL_DESCRIPTORS } from '../cli/mcpTools';
import { runCli } from '../cli/main';

const BINDING_DEMO = join(__dirname, '../../samples/binding-demo');

describe('guardian-cli coach-analyze', () => {
    it('returns schema and can find findings on a smell fixture', () => {
        const dir = mkdtempSync(join(tmpdir(), 'guardian-coach-'));
        try {
            writeFileSync(
                join(dir, 'smell.feature'),
                [
                    'Feature: Demo',
                    '',
                    '  Scenario: Bad',
                    '    Given something',
                    '    When click button',
                    '    Then it works',
                    '',
                ].join('\n'),
                'utf8'
            );
            const report = buildCoachAnalyzeReport(loadProject(dir), { maxItems: 20 });
            expect(report.schemaVersion).toBe(1);
            expect(report.counts.files).toBe(1);
            expect(report.counts.findings).toBeGreaterThan(0);
            expect(report.findings[0].ruleId).toMatch(/^coach\//);
            expect(Object.keys(report.counts.byRuleId).length).toBeGreaterThan(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('runCli coach-analyze on binding-demo exits 0', () => {
        const logs: string[] = [];
        const prevLog = console.log;
        console.log = (msg?: unknown) => {
            logs.push(String(msg));
        };
        try {
            expect(runCli(['coach-analyze', BINDING_DEMO, '--max-items', '5'])).toBe(0);
            const parsed = JSON.parse(logs.join('\n'));
            expect(parsed.schemaVersion).toBe(1);
            expect(parsed.counts.files).toBeGreaterThan(0);
            expect(parsed.findings.length).toBeLessThanOrEqual(5);
        } finally {
            console.log = prevLog;
        }
    });
});

describe('guardian MCP tool dispatch', () => {
    it('exposes four tools', () => {
        expect(MCP_TOOL_DESCRIPTORS.map((t) => t.name)).toEqual([
            'guardian_discover',
            'guardian_analyze',
            'guardian_resolve_step',
            'guardian_coach_analyze',
        ]);
    });

    it('guardian_discover maps to discover report', () => {
        const report = dispatchMcpTool('guardian_discover', { projectDir: BINDING_DEMO }) as {
            schemaVersion: number;
            bindings: unknown[];
        };
        expect(report.schemaVersion).toBe(1);
        expect(report.bindings.length).toBeGreaterThan(0);
    });

    it('guardian_resolve_step maps to resolve report', () => {
        const report = dispatchMcpTool('guardian_resolve_step', {
            projectDir: BINDING_DEMO,
            featurePath: 'Features/sample.feature',
            line: 7,
        }) as { status: string };
        expect(report.status).toBe('bound');
    });
});
