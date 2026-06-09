/**
 * behave-demo sample — resolver smoke (Python Behave)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parsePythonBehaveBindingsFromText } from '../core/parsing/pythonBehaveBindingParser';
import { createResolver } from '../core/matching/resolver';
import { createMockDocument, Uri } from './mocks/vscode';

const ROOT = join(__dirname, '../../samples/behave-demo');

describe('behave-demo sample', () => {
    it('resolves all three search.feature steps to Python bindings', () => {
        const featureText = readFileSync(join(ROOT, 'features/search.feature'), 'utf-8');
        const stepsText = readFileSync(join(ROOT, 'features/steps/search_steps.py'), 'utf-8');
        const doc = createMockDocument(featureText, join(ROOT, 'features/search.feature'));
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parsePythonBehaveBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'features/steps/search_steps.py')) as any
        );

        expect(bindings.length).toBe(3);

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
