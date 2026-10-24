import { describe, it, expect } from 'vitest';
import { parsePythonPytestBddBindingsFromText } from '../core/parsing/pythonPytestBddBindingParser';
import { declaresBehaveDependency } from '../providers/bindings/pythonBehaveProvider';
import { declaresPytestBddDependency } from '../providers/bindings/pythonPytestBddProvider';
import { Uri } from './mocks/vscode';

const uri = Uri.file('/demo/step_defs/search_steps.py') as never;

const STEPS = `from pytest_bdd import given, when, then

@given('I have cucumbers')
def have_cukes():
    pass

@given('I have {count:d} cucumbers')
def have_count(count):
    pass

@scenario('Search')
def test_search():
    pass
`;

describe('pythonPytestBddBindingParser', () => {
    it('indexes a string @given when pytest_bdd is imported', () => {
        const bindings = parsePythonPytestBddBindingsFromText(STEPS, uri);
        const literal = bindings.find((b) => b.patternRaw === 'I have cucumbers');
        expect(literal).toBeDefined();
        expect(literal!.keyword).toBe('Given');
        expect(literal!.methodName).toBe('have_cukes');
    });

    it('returns no bindings without a pytest_bdd import', () => {
        const text = STEPS.replace('pytest_bdd', 'behave');
        expect(parsePythonPytestBddBindingsFromText(text, uri)).toEqual([]);
    });

    it('compiles {count:d} as one token and ignores @scenario', () => {
        const bindings = parsePythonPytestBddBindingsFromText(STEPS, uri);
        expect(bindings.some((b) => b.patternRaw.includes('@scenario') || b.methodName === 'test_search')).toBe(false);
        const counted = bindings.find((b) => b.patternRaw.includes('{count:d}'));
        expect(counted).toBeDefined();
        expect(counted!.regex.test('I have 5 cucumbers')).toBe(true);
        expect(counted!.regex.test('I have cucumbers')).toBe(false);
    });
});

describe('pytest-bdd vs behave package detection', () => {
    it('a requirements.txt that only names pytest-bdd does not declare behave', () => {
        const content = 'pytest-bdd>=9\n';
        expect(declaresPytestBddDependency(content, 'requirements.txt')).toBe(true);
        expect(declaresBehaveDependency(content, 'requirements.txt')).toBe(false);
    });
});
