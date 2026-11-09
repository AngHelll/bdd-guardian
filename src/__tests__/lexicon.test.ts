/**
 * Lexicon rows group bindings by phrase, not by line.
 */
import { describe, it, expect } from 'vitest';
import { createResolver, type ResolverDependencies } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { MAX_ORPHAN_BINDING_SCAN } from '../core/domain/constants';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { buildLexicon, lexiconPhrase } from '../core/lexicon/lexicon';
import { SUITE_MAP_LIST_CAP } from '../core/map/suiteMap';
import { Range, Uri } from './mocks/vscode';

function createBinding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    lineNumber: number,
    filePath = '/test/Steps.cs'
): Binding {
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'TestSteps',
        methodName,
        uri: Uri.file(filePath) as Binding['uri'],
        range: new Range(lineNumber, 0, lineNumber, 80) as Binding['range'],
        lineNumber,
        signature: `TestSteps.${methodName}`,
        scopeTags: [],
    };
}

function createStep(
    keyword: ResolvedKeyword,
    text: string,
    lineNumber: number,
    filePath = '/test/a.feature'
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text.replace(/\s+/g, ' ').trim(),
        fullText: `${keyword} ${text}`,
        tagsEffective: [],
        uri: Uri.file(filePath) as FeatureStep['uri'],
        range: new Range(lineNumber, 0, lineNumber, 80) as FeatureStep['range'],
        lineNumber,
        isOutline: false,
        candidateTexts: [text],
    };
}

function resolveFor(bindings: readonly Binding[]) {
    const deps: ResolverDependencies = {
        getAllBindings: () => bindings,
        getBindingsByKeyword: (kw) => bindings.filter((binding) => binding.keyword === kw),
        preferSpecificBinding: false,
    };
    return createResolver(deps);
}

describe('lexiconPhrase', () => {
    it('keeps placeholders and does not insert sample values', () => {
        const named = lexiconPhrase('^the user {name} logs in$');
        expect(named.legible).toBe(true);
        expect(named.phrase).toBe('the user {name} logs in');
        expect(named.phrase).not.toContain('1');
        expect(named.phrase).not.toContain('"value"');

        expect(lexiconPhrase('the total is {decimal}').phrase).toBe('the total is {decimal}');
        expect(lexiconPhrase('the total is {name:converter}').phrase).toBe('the total is {name:converter}');
        expect(lexiconPhrase('the user (.*) logs in').phrase).toBe('the user {arg} logs in');
    });
});

describe('buildLexicon', () => {
    it('groups bindings that share a token sequence', () => {
        const named = createBinding('Given', 'the user {name} logs in', 'LogNamed', 10);
        const anon = createBinding('Given', 'the user (.*) logs in', 'LogAnon', 20);
        const lexicon = buildLexicon([named, anon], [], resolveFor([named, anon]));
        expect(lexicon.counts.words).toBe(1);
        expect(lexicon.rows).toHaveLength(1);
        expect(lexicon.rows[0].implementations).toHaveLength(2);
        expect(lexicon.rows[0].phrase).toContain('{');
        expect(lexicon.rows[0].phrase).not.toContain('"value"');
    });

    it('counts a bound step and ignores an ambiguous one', () => {
        const used = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
        const left = createBinding('When', 'the customer pays the bill', 'PayLeft', 30);
        const right = createBinding('When', 'the customer pays the bill', 'PayRight', 40);
        const bindings = [used, left, right];
        const steps = [
            createStep('Given', 'user is logged in', 5),
            createStep('When', 'the customer pays the bill', 6),
        ];
        let calls = 0;
        const resolve = resolveFor(bindings);
        const lexicon = buildLexicon(bindings, steps, (step) => {
            calls += 1;
            return resolve(step);
        });

        expect(calls).toBe(steps.length);
        const given = lexicon.rows.find((row) => row.keyword === 'Given');
        const when = lexicon.rows.find((row) => row.keyword === 'When');
        expect(given?.speakers).toHaveLength(1);
        expect(given?.speakers?.[0].text).toBe('user is logged in');
        expect(given?.implementations[0].speakerCount).toBe(1);
        expect(when?.implementations).toHaveLength(2);
        expect(when?.speakers).toEqual([]);
        expect(lexicon.counts.usages).toBe(1);
    });

    it('keeps a word with no speakers at zero', () => {
        const orphan = createBinding('Given', 'orphan phrase here', 'OrphanMethod', 20);
        const lexicon = buildLexicon([orphan], [], resolveFor([orphan]));
        expect(lexicon.rows[0].speakers).toEqual([]);
        expect(lexicon.counts.unused).toBe(1);
        expect(lexicon.counts.usages).toBe(0);
        expect(lexicon.usagesSkipped).toBe(false);
    });

    it('links a one-word dialect and skips a two-word drift', () => {
        const bill = createBinding('Given', 'customer pays the bill', 'PayBill', 10);
        const fine = createBinding('Given', 'customer pays the fine', 'PayFine', 20);
        const vendor = createBinding('Given', 'vendor sends the bill', 'VendorBill', 30);
        const lexicon = buildLexicon([bill, fine, vendor], [], resolveFor([bill, fine, vendor]));
        const byMethod = new Map(lexicon.rows.map((row) => [row.implementations[0].methodName, row]));
        expect(byMethod.get('PayBill')?.dialects?.map((dialect) => dialect.phrase)).toEqual([
            'customer pays the fine',
        ]);
        expect(byMethod.get('PayFine')?.dialects?.map((dialect) => dialect.phrase)).toEqual([
            'customer pays the bill',
        ]);
        expect(byMethod.get('VendorBill')?.dialects).toEqual([]);
    });

    it('does not report zero usages when the scan is skipped', () => {
        const bindings: Binding[] = [];
        for (let i = 0; i < MAX_ORPHAN_BINDING_SCAN + 1; i++) {
            const word = alpha(i);
            bindings.push({
                keyword: 'Given',
                patternRaw: `${word} token remains`,
                regex: /./,
                className: 'TestSteps',
                methodName: `M${word}`,
                uri: Uri.file('/test/Steps.cs') as Binding['uri'],
                range: new Range(i, 0, i, 10) as Binding['range'],
                lineNumber: i,
                signature: `TestSteps.M${word}`,
                scopeTags: [],
            });
        }
        const lexicon = buildLexicon(bindings, [createStep('Given', 'qqqa token remains', 1)], () => {
            throw new Error('resolve should not run when the scan is skipped');
        });
        expect(lexicon.usagesSkipped).toBe(true);
        expect(lexicon.dialectsSkipped).toBe(true);
        expect(lexicon.counts.words).toBeGreaterThan(SUITE_MAP_LIST_CAP);
        expect(lexicon.rows).toHaveLength(SUITE_MAP_LIST_CAP);
        expect(lexicon.truncated).toBe(lexicon.counts.words - SUITE_MAP_LIST_CAP);
        expect(lexicon.rows[0].speakers).toBeUndefined();
        expect(lexicon.rows[0].dialects).toBeUndefined();
        expect(lexicon.rows[0].implementations[0].speakerCount).toBeUndefined();
    });

    it('uses the method name when the pattern is illegible and alone', () => {
        const binding = createBinding('Given', '^foo.*bar$', 'FooBar', 4);
        const lexicon = buildLexicon([binding], [], resolveFor([binding]));
        expect(lexicon.rows[0].phrase).toBe('FooBar');
    });
});

function alpha(n: number): string {
    let num = n;
    let out = '';
    do {
        out = String.fromCharCode(97 + (num % 26)) + out;
        num = Math.floor(num / 26);
    } while (num > 0);
    return out.padStart(4, 'q');
}
