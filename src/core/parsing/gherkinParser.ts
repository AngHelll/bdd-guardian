/**
 * Gherkin Parser
 * Parses .feature files into FeatureDocument objects
 */

import * as vscode from 'vscode';
import {
    FeatureDocument,
    FeatureStep,
    Scenario,
    ExampleTable,
    StepKeyword,
    ResolvedKeyword,
} from '../domain/types';
import {
    TAG_LINE_REGEX,
    TABLE_ROW_REGEX,
    MAX_EXAMPLE_ROWS,
    PLACEHOLDER_REGEX,
} from '../domain/constants';
import { gherkinPatternsForText } from './gherkinDialect';
import { normalizeWhitespace, generateCandidateTexts } from '../matching/normalization';

/**
 * Parse a feature document into a structured FeatureDocument
 */
export function parseFeatureDocument(document: vscode.TextDocument): FeatureDocument | undefined {
    const text = document.getText();
    const lines = text.split('\n');
    const patterns = gherkinPatternsForText(text);
    
    let featureName = '';
    let featureTags: string[] = [];
    const backgroundSteps: FeatureStep[] = [];
    const scenarios: Scenario[] = [];
    const allSteps: FeatureStep[] = [];

    let pendingTags: string[] = [];
    let currentScenario: MutableScenario | null = null;
    let currentExamples: MutableExampleTable | null = null;
    let inBackground = false;
    let lastResolvedKeyword: ResolvedKeyword = 'Given';
    /** Feature/Rule prose swallows step-like lines. Other blocks end at the first step. */
    let description: 'swallow' | 'until-step' | null = null;
    let docstringDelim: DocstringDelim | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (docstringDelim) {
            if (trimmedLine === docstringDelim) {
                docstringDelim = null;
            }
            continue;
        }

        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const openedDocstring = docstringDelimiter(trimmedLine);
        if (openedDocstring) {
            docstringDelim = openedDocstring;
            continue;
        }

        const featureMatch = trimmedLine.match(patterns.feature);
        if (featureMatch) {
            featureName = featureMatch[1].trim();
            featureTags = [...pendingTags];
            pendingTags = [];
            description = 'swallow';
            continue;
        }

        if (patterns.rule.test(trimmedLine)) {
            if (currentScenario) {
                finalizeScenario(currentScenario, scenarios);
            }
            inBackground = false;
            currentScenario = null;
            currentExamples = null;
            lastResolvedKeyword = 'Given';
            pendingTags = [];
            description = 'swallow';
            continue;
        }

        const backgroundMatch = trimmedLine.match(patterns.background);
        if (backgroundMatch) {
            inBackground = true;
            currentScenario = null;
            currentExamples = null;
            lastResolvedKeyword = 'Given';
            pendingTags = [];
            description = 'until-step';
            continue;
        }

        const outlineMatch = trimmedLine.match(patterns.scenarioOutline);
        if (outlineMatch) {
            if (currentScenario) {
                finalizeScenario(currentScenario, scenarios);
            }
            inBackground = false;
            currentExamples = null;
            lastResolvedKeyword = 'Given';
            currentScenario = {
                type: 'Scenario Outline',
                name: outlineMatch[1].trim(),
                tags: [...pendingTags],
                steps: [],
                examples: [],
                range: new vscode.Range(i, 0, i, line.length),
            };
            pendingTags = [];
            description = 'until-step';
            continue;
        }

        const scenarioMatch = trimmedLine.match(patterns.scenario);
        if (scenarioMatch) {
            if (currentScenario) {
                finalizeScenario(currentScenario, scenarios);
            }
            inBackground = false;
            currentExamples = null;
            lastResolvedKeyword = 'Given';
            currentScenario = {
                type: 'Scenario',
                name: scenarioMatch[1].trim(),
                tags: [...pendingTags],
                steps: [],
                examples: [],
                range: new vscode.Range(i, 0, i, line.length),
            };
            pendingTags = [];
            description = 'until-step';
            continue;
        }

        const examplesMatch = trimmedLine.match(patterns.examples);
        if (examplesMatch && currentScenario) {
            currentExamples = {
                headers: [],
                rows: [],
                tags: [...pendingTags],
            };
            currentScenario.examples.push(currentExamples);
            pendingTags = [];
            description = 'until-step';
            continue;
        }

        const tagMatch = trimmedLine.match(TAG_LINE_REGEX);
        if (tagMatch) {
            description = null;
            const tags = tagMatch[1].split(/\s+/).filter(t => t.startsWith('@'));
            pendingTags.push(...tags);
            continue;
        }

        const tableMatch = trimmedLine.match(TABLE_ROW_REGEX);
        if (tableMatch) {
            if (description === 'swallow') {
                description = null;
                continue;
            }
            description = null;
            if (currentExamples) {
                const cells = tableMatch[1].split('|').map(c => c.trim());
                if (currentExamples.headers.length === 0) {
                    currentExamples.headers = cells;
                } else if (currentExamples.rows.length < MAX_EXAMPLE_ROWS) {
                    currentExamples.rows.push(cells);
                }
            }
            continue;
        }

        const stepMatch = trimmedLine.match(patterns.step);
        if (stepMatch) {
            if (description === 'swallow') {
                continue;
            }
            description = null;

            const keywordOriginal = patterns.roleOf(stepMatch[1]);
            const rawText = stepMatch[2].trim();

            let keywordResolved: ResolvedKeyword;
            if (isConjunction(keywordOriginal)) {
                keywordResolved = lastResolvedKeyword;
            } else {
                keywordResolved = keywordOriginal as ResolvedKeyword;
                lastResolvedKeyword = keywordResolved;
            }

            const tagsEffective = [...featureTags];
            if (currentScenario) {
                tagsEffective.push(...currentScenario.tags);
            }

            const scenarioExamples = currentScenario?.examples?.filter(
                (e) => e.headers.length > 0 && e.rows.length > 0
            );
            const hasExamplesForMatching =
                scenarioExamples !== undefined && scenarioExamples.length > 0;

            PLACEHOLDER_REGEX.lastIndex = 0;
            const hasPlaceholders = PLACEHOLDER_REGEX.test(rawText);
            PLACEHOLDER_REGEX.lastIndex = 0;

            const candidateTexts = generateCandidateTexts(
                rawText,
                hasExamplesForMatching ? (scenarioExamples as ExampleTable[]) : undefined
            );

            const isOutline =
                currentScenario?.type === 'Scenario Outline' ||
                (hasExamplesForMatching && hasPlaceholders);

            const step: FeatureStep = {
                keywordOriginal,
                keywordResolved,
                rawText,
                normalizedText: normalizeWhitespace(rawText),
                fullText: trimmedLine,
                tagsEffective,
                uri: document.uri,
                range: new vscode.Range(i, 0, i, line.length),
                lineNumber: i,
                scenarioName: currentScenario?.name,
                isOutline,
                candidateTexts,
            };

            if (inBackground) {
                backgroundSteps.push(step);
            } else if (currentScenario) {
                currentScenario.steps.push(step);
            }

            allSteps.push(step);
        }
    }

    // Finalize last scenario
    if (currentScenario) {
        finalizeScenario(currentScenario, scenarios);
    }

    // Re-sync outline candidates on all indexed steps (Scenario + Examples after steps)
    for (const scenario of scenarios) {
        refreshScenarioStepCandidates(scenario as unknown as MutableScenario);
    }

    if (!featureName) {
        return undefined;
    }

    return {
        uri: document.uri,
        featureName,
        featureTags,
        backgroundSteps,
        scenarios,
        allSteps,
    };
}

/**
 * Normalize step keyword to proper case
 */
type DocstringDelim = '"""' | '```';

function docstringDelimiter(trimmed: string): DocstringDelim | null {
    if (trimmed.startsWith('"""')) {
        return '"""';
    }
    if (trimmed.startsWith('```')) {
        return '```';
    }
    return null;
}

function isConjunction(keyword: StepKeyword): boolean {
    return keyword === 'And' || keyword === 'But' || keyword === '*';
}

/**
 * Re-expand step candidates after Examples tables are parsed (often below steps).
 */
function refreshScenarioStepCandidates(scenario: MutableScenario): void {
    const examples = scenario.examples.filter(
        (e) => e.headers.length > 0 && e.rows.length > 0
    );
    if (examples.length === 0) {
        return;
    }

    for (const step of scenario.steps) {
        PLACEHOLDER_REGEX.lastIndex = 0;
        const hasPlaceholders = PLACEHOLDER_REGEX.test(step.rawText);
        PLACEHOLDER_REGEX.lastIndex = 0;
        if (!hasPlaceholders) {
            continue;
        }
        const mutableStep = step as FeatureStep & { candidateTexts: string[]; isOutline: boolean };
        mutableStep.candidateTexts = generateCandidateTexts(
            step.rawText,
            examples as ExampleTable[]
        );
        mutableStep.isOutline =
            scenario.type === 'Scenario Outline' || hasPlaceholders;
    }
}

/**
 * Finalize a scenario and add to scenarios array
 */
function finalizeScenario(scenario: MutableScenario, scenarios: Scenario[]): void {
    refreshScenarioStepCandidates(scenario);
    scenarios.push({
        type: scenario.type,
        name: scenario.name,
        tags: scenario.tags,
        steps: scenario.steps,
        examples: scenario.examples,
        range: scenario.range,
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL MUTABLE TYPES (for parsing only)
// ═══════════════════════════════════════════════════════════════════════════

interface MutableScenario {
    type: 'Scenario' | 'Scenario Outline';
    name: string;
    tags: string[];
    steps: FeatureStep[];
    examples: MutableExampleTable[];
    range: vscode.Range;
}

interface MutableExampleTable {
    headers: string[];
    rows: string[][];
    tags: string[];
}
