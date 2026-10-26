/**
 * Tests for step resolver - matching steps to bindings
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createResolver, ResolverDependencies } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { Uri, Range } from './mocks/vscode';

// Helper to create mock bindings
function createBinding(
  keyword: ResolvedKeyword,
  pattern: string,
  methodName: string = 'TestMethod',
  lineNumber: number = 0
): Binding {
  return {
    keyword,
    patternRaw: pattern,
    regex: compileBindingRegex(pattern)!,
    className: 'TestSteps',
    methodName,
    uri: Uri.file('/test/steps.cs') as any,
    range: new Range(lineNumber, 0, lineNumber, 0) as any,
    lineNumber,
    signature: `TestSteps.${methodName}`,
    scopeTags: [],
  };
}

// Helper to create mock step
function createStep(
  keyword: ResolvedKeyword,
  text: string,
  originalKeyword: string = keyword
): FeatureStep {
  return {
    keywordOriginal: originalKeyword as any,
    keywordResolved: keyword,
    rawText: text,
    normalizedText: text.replace(/\s+/g, ' ').trim(),
    fullText: `${originalKeyword} ${text}`,
    tagsEffective: [],
    uri: Uri.file('/test/feature.feature') as any,
    range: new Range(0, 0, 0, 0) as any,
    lineNumber: 0,
    isOutline: false,
    candidateTexts: [text],
  };
}

describe('createResolver', () => {
  let bindings: Binding[];
  let resolve: ReturnType<typeof createResolver>;

  beforeEach(() => {
    bindings = [
      createBinding('Given', 'I have entered (\\d+) into the calculator', 'GivenNumeric'),
      createBinding('Given', 'I have entered (.*) into the calculator', 'GivenAny'),
      createBinding('Given', 'the calculator is initialized', 'GivenInit'),
      createBinding('When', 'I press "([^"]+)"', 'WhenPress'),
      createBinding('Then', 'the result should be (\\d+) on the screen', 'ThenNumeric'),
      createBinding('Then', 'the result should be (.*) on the screen', 'ThenAny'),
      createBinding('Then', 'the memory should not be affected', 'ThenMemory'),
    ];

    const deps: ResolverDependencies = {
      getAllBindings: () => bindings,
      getBindingsByKeyword: (kw: ResolvedKeyword) => 
        bindings.filter(b => b.keyword === kw),
    };

    resolve = createResolver(deps);
  });

  describe('exact matching', () => {
    it('should match a simple literal step', () => {
      const step = createStep('Given', 'the calculator is initialized');
      const result = resolve(step);
      
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].binding.methodName).toBe('GivenInit');
    });

    it('should match step with numeric parameter', () => {
      const step = createStep('Given', 'I have entered 50 into the calculator');
      const result = resolve(step);
      
      // Should have 2 candidates (\\d+ and .*)
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('scoring and specificity', () => {
    it('should rank more specific pattern (\\d+) higher than greedy (.*) when preferSpecificBinding', () => {
      const step = createStep('Given', 'I have entered 100 into the calculator');
      const result = resolve(step, { preferSpecificBinding: true });
      
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.status).toBe('bound');
      expect(result.candidates[0].binding.methodName).toBe('GivenNumeric');
    });

    it('should mark overlapping patterns as ambiguous by default (Reqnroll-like)', () => {
      const step = createStep('Given', 'I have entered 100 into the calculator');
      const result = resolve(step);
      
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.status).toBe('ambiguous');
    });

    it('should dedupe identical bindings indexed twice (Reqnroll + SpecFlow)', () => {
      bindings.push(
        createBinding('Then', 'the result should be (\\d+) on the screen', 'ThenNumeric', 0)
      );

      const step = createStep('Then', 'the result should be 15 on the screen');
      const result = resolve(step);

      expect(result.status).toBe('ambiguous');
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.binding.methodName).sort()).toEqual([
        'ThenAny',
        'ThenNumeric',
      ]);
    });

    it('should deterministically select the most specific binding when preferSpecificBinding', () => {
      const step = createStep('Then', 'the result should be 120 on the screen');
      const result = resolve(step, { preferSpecificBinding: true });
      
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.status).toBe('bound');
      expect(result.candidates[0].binding.methodName).toBe('ThenNumeric');
    });
  });

  describe('ambiguity detection', () => {
    it('should return multiple candidates for ambiguous patterns', () => {
      const step = createStep('Given', 'I have entered 50 into the calculator');
      const result = resolve(step);
      
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.status).toBe('ambiguous');
    });

    it('should mark result as ambiguous when multiple patterns match (default)', () => {
      const step = createStep('Then', 'the result should be 100 on the screen');
      const result = resolve(step);
      
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.status).toBe('ambiguous');
    });
  });

  describe('keyword inheritance (And/But)', () => {
    it('should match And step using Given bindings when context is Given', () => {
      const step = createStep('Given', 'the calculator is initialized', 'And');
      const result = resolve(step);
      
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].binding.keyword).toBe('Given');
    });

    it('should match But step using Then bindings', () => {
      const step = createStep('Then', 'the memory should not be affected', 'But');
      const result = resolve(step);
      
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].binding.keyword).toBe('Then');
    });
  });

  describe('no match scenarios', () => {
    it('should return empty candidates for non-matching step', () => {
      const step = createStep('Given', 'some step that does not exist');
      const result = resolve(step);
      
      expect(result.candidates.length).toBe(0);
    });

    it('does not bind a Given step to a When pattern of the same text', () => {
      // Previously this Given matched WhenPress through the keyword fallback.
      const step = createStep('Given', 'I press "add"');
      const result = resolve(step);

      expect(result.status).toBe('unbound');
      expect(result.candidates).toHaveLength(0);
      expect(result.best).toBeUndefined();
    });
  });
});

describe('keyword boundary', () => {
  function binding(keyword: ResolvedKeyword, pattern: string, methodName: string): Binding {
    return createBinding(keyword, pattern, methodName);
  }

  function resolveWith(items: readonly Binding[], step: FeatureStep) {
    return createResolver({
      getAllBindings: () => items,
      getBindingsByKeyword: (keyword) => items.filter((item) => item.keyword === keyword),
      preferSpecificBinding: false,
    })(step);
  }

  it('binds each keyword only to its own attribute', () => {
    const items = [
      binding('Given', 'the gate is open', 'OpenGiven'),
      binding('When', 'the gate moves', 'MoveWhen'),
      binding('Then', 'the gate is closed', 'CloseThen'),
    ];

    const given = resolveWith(items, createStep('Given', 'the gate is open'));
    expect(given.status).toBe('bound');
    expect(given.best?.keywordMatched).toBe(true);
    expect(given.best?.binding.keyword).toBe('Given');

    const when = resolveWith(items, createStep('When', 'the gate moves'));
    expect(when.status).toBe('bound');
    expect(when.best?.keywordMatched).toBe(true);
    expect(when.best?.binding.keyword).toBe('When');

    const then = resolveWith(items, createStep('Then', 'the gate is closed'));
    expect(then.status).toBe('bound');
    expect(then.best?.keywordMatched).toBe(true);
    expect(then.best?.binding.keyword).toBe('Then');
  });

  it('leaves a When unbound when the only pattern is Given', () => {
    const items = [binding('Given', 'the pump is primed', 'Primed')];
    const result = resolveWith(items, createStep('When', 'the pump is primed'));
    expect(result.status).toBe('unbound');
    expect(result.candidates).toHaveLength(0);
  });

  it('uses the resolved keyword for And, But and star', () => {
    const items = [
      binding('Given', 'the anchor is given', 'AnchorGiven'),
      binding('Given', 'the follow up is given', 'FollowGiven'),
      binding('When', 'the anchor is when', 'AnchorWhen'),
      binding('When', 'the follow up is when', 'FollowWhen'),
      binding('Then', 'the memory stays clear', 'Memory'),
    ];

    const andGiven = resolveWith(items, createStep('Given', 'the follow up is given', 'And'));
    expect(andGiven.status).toBe('bound');
    expect(andGiven.best?.keywordMatched).toBe(true);
    expect(andGiven.best?.binding.methodName).toBe('FollowGiven');

    const andWhen = resolveWith(items, createStep('When', 'the follow up is when', 'And'));
    expect(andWhen.status).toBe('bound');
    expect(andWhen.best?.binding.keyword).toBe('When');

    const andCross = resolveWith(items, createStep('When', 'the follow up is given', 'And'));
    expect(andCross.status).toBe('unbound');
    expect(andCross.candidates).toHaveLength(0);

    const but = resolveWith(items, createStep('Then', 'the memory stays clear', 'But'));
    expect(but.status).toBe('bound');
    expect(but.best?.keywordMatched).toBe(true);
    expect(but.best?.binding.keyword).toBe('Then');

    const star = resolveWith(items, createStep('Given', 'the anchor is given', '*'));
    expect(star.status).toBe('bound');
    expect(star.best?.keywordMatched).toBe(true);
    expect(star.step.keywordOriginal).toBe('*');
  });

  it('matches the StepDefinition copy of the effective keyword and ignores the others', () => {
    const items = [
      binding('Given', 'I do a generic step', 'Any'),
      binding('When', 'I do a generic step', 'Any'),
      binding('Then', 'I do a generic step', 'Any'),
    ];
    const result = resolveWith(items, createStep('When', 'I do a generic step'));
    expect(result.status).toBe('bound');
    expect(result.candidates).toHaveLength(1);
    expect(result.best?.binding.keyword).toBe('When');
    expect(result.best?.keywordMatched).toBe(true);
  });

  it('stays ambiguous when two patterns of the same keyword overlap', () => {
    const items = [
      binding('Given', 'I have entered (\\d+) into the calculator', 'Numeric'),
      binding('Given', 'I have entered (.*) into the calculator', 'Anything'),
    ];
    const result = resolveWith(items, createStep('Given', 'I have entered 100 into the calculator'));
    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.keywordMatched)).toBe(true);
  });

  it('stays unbound when the effective keyword has no candidate', () => {
    const items = [binding('Then', 'the gate is closed', 'CloseThen')];
    const result = resolveWith(items, createStep('When', 'the gate is closed'));
    expect(result.status).toBe('unbound');
    expect(result.candidates).toHaveLength(0);
    expect(result.best).toBeUndefined();
  });
});

describe('Example expansion matching', () => {
  it('should match expanded example values with \\d+ patterns', () => {
    // Scenario Outline: I have entered <first>
    // Example: first = 50
    // Expanded: I have entered 50 into the calculator
    
    const binding = createBinding('Given', 'I have entered (\\d+) into the calculator');
    const expandedText = 'I have entered 50 into the calculator';
    
    expect(binding.regex.test(expandedText)).toBe(true);
  });

  it('should match expanded example with multiple numeric values', () => {
    const binding = createBinding('Then', 'the sum of (\\d+) and (\\d+) is (\\d+)');
    
    // Expanded from: <a> and <b> is <result> with values 10, 20, 30
    const expandedText = 'the sum of 10 and 20 is 30';
    
    expect(binding.regex.test(expandedText)).toBe(true);
  });

  it('should match expanded quoted string values', () => {
    const binding = createBinding('When', 'I press "([^"]+)"');
    
    // Expanded from: "<operation>" with operation = add
    const expandedText = 'I press "add"';
    
    expect(binding.regex.test(expandedText)).toBe(true);
  });
});
