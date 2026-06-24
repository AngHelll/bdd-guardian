/**
 * java-cucumber-demo sample — resolver smoke (Java Cucumber-JVM)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseJavaCucumberBindingsFromText } from '../core/parsing/javaCucumberBindingParser';
import { createResolver } from '../core/matching/resolver';
import { createMockDocument, Uri } from './mocks/vscode';

const ROOT = join(__dirname, '../../samples/java-cucumber-demo');

describe('java-cucumber-demo sample', () => {
    it('resolves all three search.feature steps to Java bindings', () => {
        const featureText = readFileSync(
            join(ROOT, 'src/test/resources/features/search.feature'),
            'utf-8'
        );
        const stepsText = readFileSync(
            join(ROOT, 'src/test/java/com/example/steps/SearchStepDefinitions.java'),
            'utf-8'
        );
        const doc = createMockDocument(
            featureText,
            join(ROOT, 'src/test/resources/features/search.feature')
        );
        const parsed = parseFeatureDocument(doc as any)!;
        const bindings = parseJavaCucumberBindingsFromText(
            stepsText,
            Uri.file(join(ROOT, 'src/test/java/com/example/steps/SearchStepDefinitions.java')) as any
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
