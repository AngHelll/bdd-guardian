/**
 * pytest-bdd-demo sample — resolver smoke
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parsePythonPytestBddBindingsFromText } from '../core/parsing/pythonPytestBddBindingParser';
import { createResolver } from '../core/matching/resolver';
import { createMockDocument, Uri } from './mocks/vscode';

const ROOT = join(__dirname, '../../samples/pytest-bdd-demo');

describe('pytest-bdd-demo sample', () => {
    it('resolves the literal step and the {count:d} step', () => {
        const featureText = readFileSync(join(ROOT, 'features/search.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'step_defs/search_steps.py'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'features/search.feature'));
        const parsed = parseFeatureDocument(doc as never)!;
        const bindings = parsePythonPytestBddBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'step_defs/search_steps.py')) as never
        );

        expect(bindings.length).toBe(2);

        const resolve = createResolver({
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
            preferSpecificBinding: false,
        });

        for (const step of parsed.allSteps) {
            expect(resolve(step).status).toBe('bound');
        }
    });
});
