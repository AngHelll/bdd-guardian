/**
 * Precision corpus — regression tests for step-to-binding alignment (SRBA).
 * Uses synthetic matching-corpus fixtures (no proprietary domain names).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { createResolver, ResolverDependencies } from '../core/matching/resolver';
import { createMockDocument, Uri } from './mocks/vscode';
import type { FeatureStep, MatchStatus, ResolvedKeyword } from '../core/domain/types';

const FIXTURES = join(__dirname, 'fixtures');

type ExpectedStep = {
    keyword: ResolvedKeyword;
    rawText: string;
    status: MatchStatus;
    methodName?: string;
};

function loadCorpus() {
    const featureText = readFileSync(join(FIXTURES, 'matching-corpus.feature'), 'utf-8');
    const stepsText = readFileSync(join(FIXTURES, 'MatchingCorpusSteps.cs'), 'utf-8');
    const featureDoc = createMockDocument(featureText, join(FIXTURES, 'matching-corpus.feature'));
    const parsed = parseFeatureDocument(featureDoc as any);
    const bindings = parseCSharpBindingsFromText(stepsText, Uri.file(join(FIXTURES, 'MatchingCorpusSteps.cs')) as any);
    return { parsed, bindings };
}

function findStep(steps: readonly FeatureStep[], keyword: ResolvedKeyword, rawText: string): FeatureStep {
    const step = steps.find((s) => s.keywordResolved === keyword && s.rawText === rawText);
    if (!step) {
        throw new Error(`Step not found: ${keyword} ${rawText}`);
    }
    return step;
}

describe('precision corpus (matching-corpus fixtures)', () => {
    let resolve: ReturnType<typeof createResolver>;
    let allSteps: readonly FeatureStep[];

    beforeAll(() => {
        const { parsed, bindings } = loadCorpus();
        expect(parsed).toBeDefined();
        expect(bindings.length).toBeGreaterThan(10);

        const deps: ResolverDependencies = {
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        };
        resolve = createResolver(deps);
        allSteps = parsed!.allSteps;
    });

    const cases: ExpectedStep[] = [
        { keyword: 'Given', rawText: 'I have a valid access token', status: 'bound', methodName: 'GivenIHaveAValidAccessToken' },
        { keyword: 'Given', rawText: 'I have questionnaire configuration', status: 'bound', methodName: 'GivenIHaveQuestionnaireConfiguration' },
        { keyword: 'Given', rawText: 'Generate token for salary update workflow', status: 'bound', methodName: 'GivenGenerateTokenForSalaryUpdateWorkflow' },
        { keyword: 'When', rawText: 'I update the gross monthly income to <newSalary> with change date <changeDate>', status: 'bound', methodName: 'WhenIUpdateTheGrossMonthlyIncome' },
        { keyword: 'Then', rawText: 'I should get a successful salary update response', status: 'bound', methodName: 'ThenIShouldGetSuccessfulSalaryUpdateResponse' },
        { keyword: 'Then', rawText: 'the response should contain updated salary <newSalary>', status: 'bound', methodName: 'ThenResponseShouldContainUpdatedSalary' },
        { keyword: 'Given', rawText: 'Generate token for portfolio projection workflow', status: 'bound', methodName: 'GivenGenerateTokenForPortfolioProjection' },
        { keyword: 'Then', rawText: 'I should get a valid portfolio projection response', status: 'bound', methodName: 'ThenIShouldGetValidPortfolioProjectionResponse' },
        { keyword: 'When', rawText: 'I retrieve crypto variation for currency "<currency>" and time period "<time_period>"', status: 'bound', methodName: 'WhenIRetrieveCryptoVariation' },
        { keyword: 'Then', rawText: 'I should receive a successful response for crypto variation', status: 'bound', methodName: 'ThenIShouldReceiveSuccessfulResponseForCryptoVariation' },
        { keyword: 'When', rawText: 'I attempt to retrieve crypto variation <scenario>', status: 'ambiguous' },
        { keyword: 'Then', rawText: 'I should receive an error response', status: 'bound', methodName: 'ThenIShouldReceiveErrorResponse' },
    ];

    it.each(cases.map((c) => [c.keyword, c.rawText, c.status, c.methodName ?? ''] as const))(
        '%s %s → %s',
        (keyword, rawText, expectedStatus, expectedMethod) => {
            const step = findStep(allSteps, keyword, rawText);
            const result = resolve(step);
            expect(result.status).toBe(expectedStatus);
            if (expectedMethod) {
                expect(result.best?.binding.methodName).toBe(expectedMethod);
            }
        }
    );

    it('flags ambiguous when specific and generic crypto attempt patterns both match', () => {
        const step = findStep(
            allSteps,
            'When',
            'I attempt to retrieve crypto variation <scenario>'
        );
        expect(step.candidateTexts.some((c) =>
            c.includes('invalid time period')
        )).toBe(true);
        const result = resolve(step);
        expect(result.status).toBe('ambiguous');
        expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    });

    it('portfolio alternation row — bound via outline candidates and alternation regex', () => {
        const step = findStep(
            allSteps,
            'When',
            'I request portfolio projection for <portfolioType> with investment time <years> years, first deposit <firstDeposit>, and monthly deposit <monthlyDeposit>'
        );
        const result = resolve(step);
        expect(result.status).toBe('bound');
        expect(result.best?.binding.methodName).toBe('WhenIRequestPortfolioProjection');
    });
});

describe('precision corpus — calculator overlap (strict ambiguity)', () => {
    it('marks overlapping \\d+ and .* as ambiguous by default', () => {
        const extra = [
            {
                keyword: 'Given' as const,
                patternRaw: 'I have entered (\\d+) into the calculator',
                regex: compileBindingRegex('I have entered (\\d+) into the calculator')!,
                className: 'Calc',
                methodName: 'GivenNumeric',
                uri: Uri.file('/c.cs') as any,
                range: {} as any,
                lineNumber: 0,
                signature: 'Calc.GivenNumeric',
            },
            {
                keyword: 'Given' as const,
                patternRaw: 'I have entered (.*) into the calculator',
                regex: compileBindingRegex('I have entered (.*) into the calculator')!,
                className: 'Calc',
                methodName: 'GivenAny',
                uri: Uri.file('/c.cs') as any,
                range: {} as any,
                lineNumber: 0,
                signature: 'Calc.GivenAny',
            },
        ];
        const overlapDeps: ResolverDependencies = {
            getAllBindings: () => extra,
            getBindingsByKeyword: (kw) => extra.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        };
        const overlapResolve = createResolver(overlapDeps);
        const step: FeatureStep = {
            keywordOriginal: 'Given',
            keywordResolved: 'Given',
            rawText: 'I have entered 50 into the calculator',
            normalizedText: 'I have entered 50 into the calculator',
            fullText: 'Given I have entered 50 into the calculator',
            tagsEffective: [],
            uri: Uri.file('/test.feature') as any,
            range: {} as any,
            lineNumber: 0,
            isOutline: false,
            candidateTexts: ['I have entered 50 into the calculator'],
        };
        const result = overlapResolve(step);
        expect(result.status).toBe('ambiguous');
    });
});
