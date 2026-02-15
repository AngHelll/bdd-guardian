/**
 * Adapter: FeatureDocument (core) → GherkinModel (coach).
 * Allows Coach to use the single core Gherkin parser instead of a duplicate parser.
 */

import * as vscode from 'vscode';
import type { FeatureDocument, FeatureStep, Scenario, ExampleTable } from '../../core/domain/types';
import { parseFeatureDocument } from '../../core/parsing';
import type {
    GherkinModel,
    GherkinScenario,
    GherkinStep,
    GherkinBackground,
    GherkinExamples,
} from './rules/types';

function stepToGherkinStep(step: FeatureStep): GherkinStep {
    return {
        keyword: step.keywordOriginal,
        keywordResolved: step.keywordResolved,
        text: step.rawText,
        fullText: step.fullText,
        line: step.lineNumber,
    };
}

function examplesToGherkinExamples(table: ExampleTable, scenarioStartLine: number): GherkinExamples {
    return {
        line: scenarioStartLine,
        headers: [...table.headers],
        rowCount: table.rows.length,
        tags: [...table.tags],
    };
}

function scenarioToGherkinScenario(s: Scenario): GherkinScenario {
    return {
        title: s.name,
        line: s.range.start.line,
        isOutline: s.type === 'Scenario Outline',
        steps: s.steps.map(stepToGherkinStep),
        examples: s.examples.map(ex => examplesToGherkinExamples(ex, s.range.start.line)),
        tags: [...s.tags],
    };
}

/**
 * Converts a core FeatureDocument into the Coach's GherkinModel.
 */
export function featureDocumentToGherkinModel(doc: FeatureDocument): GherkinModel {
    const background: GherkinBackground | undefined =
        doc.backgroundSteps.length > 0
            ? {
                  line: doc.backgroundSteps[0].lineNumber,
                  steps: doc.backgroundSteps.map(stepToGherkinStep),
              }
            : undefined;

    return {
        featureTitle: doc.featureName,
        featureLine: 0,
        featureTags: [...doc.featureTags],
        scenarios: doc.scenarios.map(scenarioToGherkinScenario),
        background,
    };
}

const EMPTY_MODEL: GherkinModel = {
    scenarios: [],
    featureTags: [],
};

/**
 * Parse a .feature document using the core parser and return a GherkinModel for Coach.
 * Returns an empty model if the document has no Feature title or parsing fails.
 */
export function parseFeatureDocumentToGherkinModel(
    document: vscode.TextDocument
): GherkinModel {
    const doc = parseFeatureDocument(document);
    return doc ? featureDocumentToGherkinModel(doc) : EMPTY_MODEL;
}
