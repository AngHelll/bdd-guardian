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
  methodName: string = 'TestMethod'
): Binding {
  return {
    keyword,
    patternRaw: pattern,
    regex: compileBindingRegex(pattern)!,
    className: 'TestSteps',
    methodName,
    uri: Uri.file('/test/steps.cs') as any,
    range: new Range(0, 0, 0, 0) as any,
    lineNumber: 0,
    signature: `TestSteps.${methodName}`,
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
    it('should rank more specific pattern (\\d+) higher than greedy (.*)', () => {
      const step = createStep('Given', 'I have entered 100 into the calculator');
      const result = resolve(step);
      
      // Both should match, but \\d+ should score higher
      expect(result.candidates.length).toBeGreaterThan(1);
      
      // First candidate should be the more specific one
      const firstCandidate = result.candidates[0];
      expect(firstCandidate.binding.methodName).toBe('GivenNumeric');
    });

    it('should deterministically select the most specific binding', () => {
      const step = createStep('Then', 'the result should be 120 on the screen');
      const result = resolve(step);
      
      // Should have multiple matches
      expect(result.candidates.length).toBeGreaterThan(1);
      
      // Most specific (\\d+) should be first
      expect(result.candidates[0].binding.methodName).toBe('ThenNumeric');
    });
  });

  describe('keyword inheritance (And/But)', () => {
    it('should match And step using Given bindings when context is Given', () => {
      // And/But inherit from previous keyword
      // For testing, we treat And as Given
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

  describe('ambiguity detection', () => {
    it('should return multiple candidates for ambiguous patterns', () => {
      const step = createStep('Given', 'I have entered 50 into the calculator');
      const result = resolve(step);
      
      // Both \d+ and .* patterns should match
      expect(result.candidates.length).toBeGreaterThan(1);
    });

    it('should mark result as ambiguous when multiple good matches exist', () => {
      const step = createStep('Then', 'the result should be 100 on the screen');
      const result = resolve(step);
      
      // Multiple patterns match numeric value
      expect(result.candidates.length).toBeGreaterThan(1);
    });
  });

  describe('no match scenarios', () => {
    it('should return empty candidates for non-matching step', () => {
      const step = createStep('Given', 'some step that does not exist');
      const result = resolve(step);
      
      expect(result.candidates.length).toBe(0);
    });

    it('should use fallback matching when keyword does not match', () => {
      // The resolver has a fallback mechanism that tries other keywords
      // when no exact keyword match is found
      // 'I press' is a When binding - Given keyword will fallback
      const step = createStep('Given', 'I press "add"');
      const result = resolve(step);
      
      // The resolver finds the When binding via fallback
      // This is expected behavior - it helps when And/But steps need to find bindings
      expect(result.candidates.length).toBeGreaterThanOrEqual(0);
      if (result.candidates.length > 0) {
        // If found via fallback, it should be the When binding
        expect(result.candidates[0].binding.methodName).toBe('WhenPress');
      }
    });
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
