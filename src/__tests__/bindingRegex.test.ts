/**
 * Tests for binding regex compilation and pattern matching
 */
import { describe, it, expect } from 'vitest';
import { compileBindingRegex, isPatternAnchored, countCaptureGroups } from '../core/parsing/bindingRegex';

describe('compileBindingRegex', () => {
  describe('basic pattern compilation', () => {
    it('should compile a simple literal pattern', () => {
      const regex = compileBindingRegex('the calculator is initialized');
      expect(regex).not.toBeNull();
      expect(regex!.test('the calculator is initialized')).toBe(true);
      expect(regex!.test('something else')).toBe(false);
    });

    it('should compile pattern with \\d+ capture group', () => {
      const regex = compileBindingRegex('I have entered (\\d+) into the calculator');
      expect(regex).not.toBeNull();
      expect(regex!.test('I have entered 50 into the calculator')).toBe(true);
      expect(regex!.test('I have entered 100 into the calculator')).toBe(true);
      expect(regex!.test('I have entered abc into the calculator')).toBe(false);
    });

    it('should compile pattern with [^"]* capture group for quoted strings', () => {
      const regex = compileBindingRegex('the display shows "([^"]*)"');
      expect(regex).not.toBeNull();
      expect(regex!.test('the display shows "0"')).toBe(true);
      expect(regex!.test('the display shows "Hello World"')).toBe(true);
      expect(regex!.test('the display shows ""')).toBe(true);
    });

    it('should compile pattern with (.*) greedy capture', () => {
      const regex = compileBindingRegex('the result should be (.*) on the screen');
      expect(regex).not.toBeNull();
      expect(regex!.test('the result should be 120 on the screen')).toBe(true);
      expect(regex!.test('the result should be "success" on the screen')).toBe(true);
      expect(regex!.test('the result should be  on the screen')).toBe(true);
    });
  });

  describe('anchored patterns (^...$)', () => {
    it('should handle already anchored pattern correctly', () => {
      const regex = compileBindingRegex('^I press "([^"]+)"$');
      expect(regex).not.toBeNull();
      expect(regex!.test('I press "add"')).toBe(true);
      expect(regex!.test('I press "subtract"')).toBe(true);
    });

    it('should auto-anchor patterns that are not anchored', () => {
      // compileBindingRegex adds ^ and $ if not present
      const regex = compileBindingRegex('simple pattern');
      expect(regex).not.toBeNull();
      // Should require exact match because anchors are added
      expect(regex!.test('simple pattern')).toBe(true);
      expect(regex!.test('a simple pattern here')).toBe(false);
    });
  });

  describe('verbatim string handling at parse level', () => {
    it('should handle pattern with escaped quotes correctly', () => {
      // Note: The "" -> " conversion happens in the C# parser, not in compileBindingRegex
      // compileBindingRegex receives already-processed patterns
      // This test verifies that patterns with quotes work correctly
      const regex = compileBindingRegex('the message is "([^"]*)"');
      expect(regex).not.toBeNull();
      expect(regex!.test('the message is "Hello World"')).toBe(true);
      expect(regex!.test('the message is "test"')).toBe(true);
    });

    it('should match step with quoted value when pattern has "(.*)" (e.g. C# they click on ""(.*)"" in the menu)', () => {
      // After C# verbatim "" -> ", pattern becomes: they click on "(.*)" in the menu
      const regex = compileBindingRegex('they click on "(.*)" in the menu');
      expect(regex).not.toBeNull();
      expect(regex!.test('they click on "Projects" in the menu')).toBe(true);
      expect(regex!.test('they click on "Notes" in the menu')).toBe(true);
      const m = regex!.exec('they click on "Projects" in the menu');
      expect(m).not.toBeNull();
      expect(m![1]).toBe('Projects');
    });
  });

  describe('case sensitivity', () => {
    it('should be case-sensitive by default', () => {
      const regex = compileBindingRegex('The Calculator', false);
      expect(regex).not.toBeNull();
      expect(regex!.test('The Calculator')).toBe(true);
      expect(regex!.test('the calculator')).toBe(false);
    });

    it('should be case-insensitive when specified', () => {
      const regex = compileBindingRegex('The Calculator', true);
      expect(regex).not.toBeNull();
      expect(regex!.test('The Calculator')).toBe(true);
      expect(regex!.test('the calculator')).toBe(true);
      expect(regex!.test('THE CALCULATOR')).toBe(true);
    });
  });

  describe('special regex characters', () => {
    it('should handle regex metacharacters that are part of the pattern', () => {
      const regex = compileBindingRegex('value is \\$100\\.00');
      expect(regex).not.toBeNull();
      expect(regex!.test('value is $100.00')).toBe(true);
    });

    it('should treat literal $ in pattern as dollar sign (e.g. C# verbatim)', () => {
      const regex = compileBindingRegex('Cost is $5');
      expect(regex).not.toBeNull();
      expect(regex!.test('Cost is $5')).toBe(true);
      expect(regex!.test('Cost is 5')).toBe(false);
    });

    it('should treat literal $ in middle only (end $ remains anchor)', () => {
      const regex = compileBindingRegex('Price: $10.50');
      expect(regex).not.toBeNull();
      expect(regex!.test('Price: $10.50')).toBe(true);
    });

    it('should preserve ^ at start and $ at end as anchors', () => {
      const regex = compileBindingRegex('^exact$');
      expect(regex).not.toBeNull();
      expect(regex!.test('exact')).toBe(true);
      expect(regex!.test(' exact')).toBe(false);
      expect(regex!.test('exact ')).toBe(false);
    });

    it('should work with patterns containing dots as any character', () => {
      const regex = compileBindingRegex('value is .+');
      expect(regex).not.toBeNull();
      expect(regex!.test('value is 123')).toBe(true);
      expect(regex!.test('value is abc')).toBe(true);
    });
  });

  describe('Unicode (flag u)', () => {
    it('should match step text with accented characters', () => {
      const regex = compileBindingRegex('I have (\\d+) café');
      expect(regex).not.toBeNull();
      expect(regex!.test('I have 2 café')).toBe(true);
      expect(regex!.test('I have 1 cafe')).toBe(false);
    });
  });

  describe('invalid patterns and fallback', () => {
    it('should use literal fallback when regex is invalid so binding is not dropped', () => {
      const regex = compileBindingRegex('[invalid(');
      expect(regex).not.toBeNull();
      expect(regex!.test('[invalid(')).toBe(true);
      expect(regex!.test('other')).toBe(false);
    });
  });
});

describe('isPatternAnchored', () => {
  it('should return true for fully anchored patterns', () => {
    expect(isPatternAnchored('^test$')).toBe(true);
    expect(isPatternAnchored('^I have (\\d+) apples$')).toBe(true);
  });

  it('should return false for non-anchored patterns', () => {
    expect(isPatternAnchored('test')).toBe(false);
    expect(isPatternAnchored('^test')).toBe(false);
    expect(isPatternAnchored('test$')).toBe(false);
  });
});

describe('countCaptureGroups', () => {
  it('should count simple capture groups', () => {
    expect(countCaptureGroups('(\\d+)')).toBe(1);
    expect(countCaptureGroups('(\\d+) and (\\d+)')).toBe(2);
    expect(countCaptureGroups('I have (\\d+) apples and (\\d+) oranges')).toBe(2);
  });

  it('should not count non-capturing groups', () => {
    expect(countCaptureGroups('(?:non-capturing)')).toBe(0);
    expect(countCaptureGroups('(\\d+) (?:and) (\\d+)')).toBe(2);
  });

  it('should not count escaped parentheses', () => {
    expect(countCaptureGroups('\\(escaped\\)')).toBe(0);
    expect(countCaptureGroups('(\\d+) \\(note\\)')).toBe(1);
  });

  it('should return 0 for no groups', () => {
    expect(countCaptureGroups('simple text')).toBe(0);
  });
});
