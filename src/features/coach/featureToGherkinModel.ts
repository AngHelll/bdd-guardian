/**
 * Adapter: FeatureDocument (core) → GherkinModel (coach).
 * VS Code TextDocument entry lives here; pure adapter is featureDocumentAdapter.ts.
 */

import * as vscode from 'vscode';
import { parseFeatureDocument } from '../../core/parsing';
import type { GherkinModel } from './rules/types';
import {
    featureDocumentToGherkinModel,
    EMPTY_GHERKIN_MODEL,
} from './featureDocumentAdapter';

export { featureDocumentToGherkinModel } from './featureDocumentAdapter';

/**
 * Parse a .feature document using the core parser and return a GherkinModel for Coach.
 * Returns an empty model if the document has no Feature title or parsing fails.
 */
export function parseFeatureDocumentToGherkinModel(
    document: vscode.TextDocument
): GherkinModel {
    const doc = parseFeatureDocument(document);
    return doc ? featureDocumentToGherkinModel(doc) : EMPTY_GHERKIN_MODEL;
}
