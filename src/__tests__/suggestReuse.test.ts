import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { loadProject } from '../cli/loadProject';
import { dispatchMcpTool } from '../cli/mcpTools';
import { buildSuggestReuseReport } from '../cli/suggestReuse';
import { runCli } from '../cli/main';
import type { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import {
    suggestReuse,
    type ReuseBindingSource,
} from '../core/reuse/suggestReuse';
import { suggestReuseForUnboundStep } from '../features/reuse/unboundReuseHint';
import { Range, Uri } from './mocks/vscode';

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

describe('suggestReuse', () => {
    const press = source({
        patternRaw: '^I press "([^"]+)"$',
        methodName: 'WhenIPress',
        keyword: 'When',
    });
    const enteredDigit = source({
        patternRaw: 'I have entered (\\d+) into the calculator',
        methodName: 'GivenIHaveEntered',
        keyword: 'Given',
        filePath: 'StepDefinitions/SampleSteps.cs',
        line: 24,
    });
    const enteredAny = source({
        patternRaw: 'I have entered (.*) into the calculator',
        methodName: 'GivenIHaveEnteredAnything',
        keyword: 'Given',
        filePath: 'StepDefinitions/SampleSteps.cs',
        line: 72,
    });

    it('suggests the press binding when the step only adds words', () => {
        const result = suggestReuse('I press the "add" button extra', 'When', [press]);
        expect(result.kind).toBe('reuse');
        if (result.kind !== 'reuse') {
            return;
        }
        expect(result.humanized.toLowerCase()).toContain('press');
        expect(result.methodName).toBe('WhenIPress');
    });

    it('prefers the numeric entered pattern over the greedy one', () => {
        const result = suggestReuse('I have entered 50 into the calculator today', 'Given', [
            enteredAny,
            enteredDigit,
        ]);
        expect(result.kind).toBe('reuse');
        if (result.kind !== 'reuse') {
            return;
        }
        expect(result.methodName).toBe('GivenIHaveEntered');
        expect(result.score).toBeGreaterThanOrEqual(0.5);
    });

    it('stays silent for a different literal (press submit vs press cancel)', () => {
        const result = suggestReuse('I press submit', 'When', [
            source({ patternRaw: 'I press cancel', keyword: 'When', methodName: 'PressCancel' }),
        ]);
        expect(result).toEqual({ kind: 'none' });
    });

    it('stays silent when only the slot overlaps (click vs press)', () => {
        const result = suggestReuse('I click "Submit"', 'When', [press]);
        expect(result).toEqual({ kind: 'none' });
    });

    it('stays silent on a score tie', () => {
        const a = source({ patternRaw: 'I press cancel', keyword: 'When', methodName: 'A' });
        const b = source({ patternRaw: 'I press cancel', keyword: 'When', methodName: 'B' });
        const result = suggestReuse('I press the cancel key extra', 'When', [a, b]);
        expect(result).toEqual({ kind: 'none' });
    });

    it('ignores a binding with a different keyword', () => {
        const result = suggestReuse('I press the "add" button extra', 'Then', [press]);
        expect(result).toEqual({ kind: 'none' });
    });

    it('returns none for an empty binding list', () => {
        expect(suggestReuse('I press the "add" button extra', 'When', [])).toEqual({ kind: 'none' });
    });

    it('drops a scoped binding when the step has no matching tags', () => {
        const step = featureStep('Given', 'I log in with scoped credentials');
        const scoped = binding('Given', 'I log in with scoped credentials', 'LoginWeb', ['web']);
        expect(suggestReuseForUnboundStep(step, [scoped])).toEqual({ kind: 'none' });
        const tagged = featureStep('Given', 'I log in with scoped credentials', ['web']);
        const hinted = suggestReuseForUnboundStep(tagged, [scoped]);
        expect(hinted.kind).toBe('reuse');
        if (hinted.kind === 'reuse') {
            expect(hinted.methodName).toBe('LoginWeb');
        }
    });
});

function featureStep(
    keyword: ResolvedKeyword,
    text: string,
    tagsEffective: readonly string[] = []
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text,
        fullText: `${keyword} ${text}`,
        tagsEffective,
        uri: Uri.file('/test/a.feature') as FeatureStep['uri'],
        range: new Range(5, 0, 5, 40) as FeatureStep['range'],
        lineNumber: 5,
        isOutline: false,
        candidateTexts: [text],
    };
}

function binding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    scopeTags: readonly string[]
): Binding {
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'TestSteps',
        methodName,
        uri: Uri.file('/test/Steps.cs') as Binding['uri'],
        range: new Range(10, 0, 10, 40) as Binding['range'],
        lineNumber: 10,
        signature: `TestSteps.${methodName}`,
        scopeTags,
    };
}

describe('suggest-reuse CLI / MCP', () => {
    const step = 'I have entered 50 into the calculator today';

    it('reports reuse against binding-demo for a Given near-miss', () => {
        const project = loadProject(BINDING_DEMO);
        const report = buildSuggestReuseReport(project, step, 'Given');
        expect(report.schemaVersion).toBe(1);
        expect(report.status).toBe('reuse');
        expect(report.suggestion?.path).toMatch(/StepDefinitions\//);
        expect(report.suggestion?.methodName).toBe('GivenIHaveEntered');
        expect(report.suggestion?.humanized.toLowerCase()).toContain('entered');
    });

    it('reports none when the keyword cannot see that binding', () => {
        const project = loadProject(BINDING_DEMO);
        const report = buildSuggestReuseReport(project, step, 'Then');
        expect(report.status).toBe('none');
        expect(report.suggestion).toBeNull();
    });

    it('dispatchMcpTool matches the CLI report', () => {
        const viaMcp = dispatchMcpTool('guardian_suggest_reuse', {
            projectDir: BINDING_DEMO,
            stepText: step,
            keyword: 'Given',
        }) as { status: string; suggestion: { methodName: string } | null };
        expect(viaMcp.status).toBe('reuse');
        expect(viaMcp.suggestion?.methodName).toBe('GivenIHaveEntered');
    });

    it('runCli suggest-reuse prints JSON exit 0', () => {
        const logs: string[] = [];
        const prevLog = console.log;
        console.log = (msg?: unknown) => {
            logs.push(String(msg));
        };
        try {
            expect(
                runCli(['suggest-reuse', BINDING_DEMO, '--step', step, '--keyword', 'Given'])
            ).toBe(0);
            const parsed = JSON.parse(logs.join('\n')) as { status: string };
            expect(parsed.status).toBe('reuse');
        } finally {
            console.log = prevLog;
        }
    });

    it('runCli rejects a bad keyword', () => {
        expect(runCli(['suggest-reuse', BINDING_DEMO, '--step', step, '--keyword', 'And'])).toBe(2);
    });
});
