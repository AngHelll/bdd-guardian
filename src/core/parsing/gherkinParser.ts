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
    STEP_KEYWORD_REGEX,
    TAG_LINE_REGEX,
    FEATURE_REGEX,
    BACKGROUND_REGEX,
    SCENARIO_REGEX,
    SCENARIO_OUTLINE_REGEX,
    EXAMPLES_REGEX,
    TABLE_ROW_REGEX,
    MAX_EXAMPLE_ROWS,
} from '../domain/constants';
import { normalizeWhitespace, generateCandidateTexts } from '../matching/normalization';

/**
 * Parse a feature document into a structured FeatureDocument
 */
export function parseFeatureDocument(document: vscode.TextDocument): FeatureDocument | undefined {
    const lines = document.getText().split('\n');
    
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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        // Parse tags
        const tagMatch = trimmedLine.match(TAG_LINE_REGEX);
        if (tagMatch) {
            const tags = tagMatch[1].split(/\s+/).filter(t => t.startsWith('@'));
            pendingTags.push(...tags);
            continue;
        }

        // Parse Feature:
        const featureMatch = trimmedLine.match(FEATURE_REGEX);
        if (featureMatch) {
            featureName = featureMatch[1].trim();
            featureTags = [...pendingTags];
            pendingTags = [];
            continue;
        }

        // Parse Background:
        const backgroundMatch = trimmedLine.match(BACKGROUND_REGEX);
        if (backgroundMatch) {
            inBackground = true;
            currentScenario = null;
            currentExamples = null;
            lastResolvedKeyword = 'Given';
            pendingTags = [];
            continue;
        }

        // Parse Scenario:
        const scenarioMatch = trimmedLine.match(SCENARIO_REGEX);
        if (scenarioMatch) {
            // Finalize previous scenario
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
            continue;
        }

        // Parse Scenario Outline:
        const outlineMatch = trimmedLine.match(SCENARIO_OUTLINE_REGEX);
        if (outlineMatch) {
            // Finalize previous scenario
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
            continue;
        }

        // Parse Examples:
        const examplesMatch = trimmedLine.match(EXAMPLES_REGEX);
        if (examplesMatch && currentScenario?.type === 'Scenario Outline') {
            currentExamples = {
                headers: [],
                rows: [],
                tags: [...pendingTags],
            };
            currentScenario.examples.push(currentExamples);
            pendingTags = [];
            continue;
        }

        // Parse table rows (for Examples)
        const tableMatch = trimmedLine.match(TABLE_ROW_REGEX);
        if (tableMatch && currentExamples) {
            const cells = tableMatch[1].split('|').map(c => c.trim());
            
            if (currentExamples.headers.length === 0) {
                currentExamples.headers = cells;
            } else if (currentExamples.rows.length < MAX_EXAMPLE_ROWS) {
                currentExamples.rows.push(cells);
            }
            continue;
        }

        // Parse step lines
        const stepMatch = trimmedLine.match(STEP_KEYWORD_REGEX);
        if (stepMatch) {
            const keywordOriginal = normalizeKeyword(stepMatch[1]);
            const rawText = stepMatch[2].trim();

            // Resolve And/But to previous keyword
            let keywordResolved: ResolvedKeyword;
            if (keywordOriginal === 'And' || keywordOriginal === 'But') {
                keywordResolved = lastResolvedKeyword;
            } else {
                keywordResolved = keywordOriginal as ResolvedKeyword;
                lastResolvedKeyword = keywordResolved;
            }

            // Compute effective tags
            const tagsEffective = [...featureTags];
            if (currentScenario) {
                tagsEffective.push(...currentScenario.tags);
            }

            // Determine if in scenario outline
            const isOutline = currentScenario?.type === 'Scenario Outline';
            const examples = isOutline ? currentScenario?.examples : undefined;

            // Generate candidate texts for matching
            const candidateTexts = generateCandidateTexts(rawText, examples as ExampleTable[] | undefined);

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
function normalizeKeyword(keyword: string): StepKeyword {
    const lower = keyword.toLowerCase();
    switch (lower) {
        case 'given': return 'Given';
        case 'when': return 'When';
        case 'then': return 'Then';
        case 'and': return 'And';
        case 'but': return 'But';
        default: return 'Given';
    }
}

/**
 * Finalize a scenario and add to scenarios array
 */
function finalizeScenario(scenario: MutableScenario, scenarios: Scenario[]): void {
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
