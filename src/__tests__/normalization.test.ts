/**
 * Tests for text normalization
 */
import { describe, it, expect } from 'vitest';
import { normalizeWhitespace, normalizeStepText } from '../core/matching/normalization';

describe('normalizeWhitespace', () => {
  it('should collapse multiple spaces to single space', () => {
    expect(normalizeWhitespace('hello    world')).toBe('hello world');
    expect(normalizeWhitespace('a   b   c')).toBe('a b c');
  });

  it('should convert tabs to spaces', () => {
    expect(normalizeWhitespace('hello\tworld')).toBe('hello world');
    expect(normalizeWhitespace('a\t\tb')).toBe('a b');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello  ')).toBe('hello');
    expect(normalizeWhitespace('\t hello \t')).toBe('hello');
  });

  it('should handle mixed whitespace', () => {
    expect(normalizeWhitespace('  hello \t  world  ')).toBe('hello world');
    expect(normalizeWhitespace('\n\t  a  \t\n  b  \n')).toBe('a b');
  });

  it('should handle empty string', () => {
    expect(normalizeWhitespace('')).toBe('');
    expect(normalizeWhitespace('   ')).toBe('');
  });

  it('should preserve single spaces', () => {
    expect(normalizeWhitespace('hello world')).toBe('hello world');
  });
});

describe('normalizeStepText', () => {
  it('should normalize step text for matching', () => {
    const result = normalizeStepText('  I have entered    50    into the calculator  ');
    expect(result).toBe('I have entered 50 into the calculator');
  });

  it('should handle tabs in step text', () => {
    const result = normalizeStepText('I\thave\tentered\t50');
    expect(result).toBe('I have entered 50');
  });
});
