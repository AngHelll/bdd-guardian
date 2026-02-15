/**
 * Parsing Tests - Validate Gherkin and C# binding parsing.
 * 
 * Ensures:
 * - Feature files are parsed correctly
 * - Step keywords are identified
 * - Scenario Outlines and Examples are handled
 * - C# binding attributes are extracted
 */

import { describe, it, expect } from 'vitest';
import { compileBindingRegex } from '../core/parsing/bindingRegex';

describe('Gherkin Parsing', () => {
    describe('step keyword detection', () => {
        const keywords = ['Given', 'When', 'Then', 'And', 'But'];
        const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.+)$/i;
        
        keywords.forEach(keyword => {
            it(`should detect ${keyword} keyword`, () => {
                const line = `    ${keyword} I have a valid access token`;
                const match = line.match(stepRegex);
                
                expect(match).not.toBeNull();
                expect(match![1].toLowerCase()).toBe(keyword.toLowerCase());
                expect(match![2]).toBe('I have a valid access token');
            });
        });
        
        it('should handle case-insensitive keywords', () => {
            const lines = [
                'given the calculator is initialized',
                'WHEN I press "add"',
                'ThEn the result should be 100',
            ];
            
            lines.forEach(line => {
                const match = line.match(stepRegex);
                expect(match).not.toBeNull();
            });
        });
        
        it('should preserve step text with special characters', () => {
            const line = '    When I retrieve crypto variation for currency "MXN" and time period "one_day"';
            const match = line.match(stepRegex);
            
            expect(match).not.toBeNull();
            expect(match![2]).toBe('I retrieve crypto variation for currency "MXN" and time period "one_day"');
        });
    });
    
    describe('Scenario Outline placeholder detection', () => {
        const placeholderRegex = /<([^>]+)>/g;
        
        it('should detect single placeholder', () => {
            const text = 'I update the salary to <newSalary>';
            const matches = [...text.matchAll(placeholderRegex)];
            
            expect(matches).toHaveLength(1);
            expect(matches[0][1]).toBe('newSalary');
        });
        
        it('should detect multiple placeholders', () => {
            const text = 'I request portfolio projection for <portfolioType> with investment time <years> years';
            const matches = [...text.matchAll(placeholderRegex)];
            
            expect(matches).toHaveLength(2);
            expect(matches[0][1]).toBe('portfolioType');
            expect(matches[1][1]).toBe('years');
        });
        
        it('should detect all GBM PPR placeholders', () => {
            const text = 'I request portfolio projection for <portfolioType> with investment time <years> years, first deposit <firstDeposit>, and monthly deposit <monthlyDeposit>';
            const matches = [...text.matchAll(placeholderRegex)];
            
            expect(matches).toHaveLength(4);
            expect(matches.map(m => m[1])).toEqual([
                'portfolioType',
                'years',
                'firstDeposit',
                'monthlyDeposit',
            ]);
        });
        
        it('should return empty for no placeholders', () => {
            const text = 'I should receive a successful response';
            const matches = [...text.matchAll(placeholderRegex)];
            
            expect(matches).toHaveLength(0);
        });
    });
    
    describe('Examples table parsing', () => {
        it('should parse simple Examples table', () => {
            const tableLines = [
                '| currency | time_period |',
                '| MXN      | one_day     |',
                '| USD      | one_week    |',
            ];
            
            const result = parseExamplesTable(tableLines);
            
            expect(result.headers).toEqual(['currency', 'time_period']);
            expect(result.rows).toHaveLength(2);
            expect(result.rows[0]).toEqual(['MXN', 'one_day']);
            expect(result.rows[1]).toEqual(['USD', 'one_week']);
        });
        
        it('should parse PPR projection Examples', () => {
            const tableLines = [
                '| portfolioType | years | firstDeposit | monthlyDeposit |',
                '| debt          | 5     | 1000         | 1000           |',
                '| balance       | 10    | 5000         | 2000           |',
                '| growth        | 5     | 1000         | 1000           |',
            ];
            
            const result = parseExamplesTable(tableLines);
            
            expect(result.headers).toEqual(['portfolioType', 'years', 'firstDeposit', 'monthlyDeposit']);
            expect(result.rows).toHaveLength(3);
        });
        
        it('should handle whitespace in cells', () => {
            const tableLines = [
                '|  scenario                                                    |',
                '|  without time period                                         |',
                '|  for currency "MXN" and invalid time period "invalid_period" |',
            ];
            
            const result = parseExamplesTable(tableLines);
            
            expect(result.headers).toEqual(['scenario']);
            expect(result.rows[0][0]).toBe('without time period');
            expect(result.rows[1][0]).toBe('for currency "MXN" and invalid time period "invalid_period"');
        });
    });
});

describe('C# Binding Parsing', () => {
    describe('attribute extraction', () => {
        const attributeRegex = /\[(Given|When|Then)\s*\(\s*@?"([^"]+)"\s*\)\]/i;
        
        it('should extract Given attribute', () => {
            const line = '[Given(@"I have a valid access token")]';
            const match = line.match(attributeRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('Given');
            expect(match![2]).toBe('I have a valid access token');
        });
        
        it('should extract When attribute with pattern', () => {
            const line = '[When(@"I update the gross monthly income to (\\d+) with change date (.+)")]';
            const match = line.match(attributeRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('When');
            expect(match![2]).toBe('I update the gross monthly income to (\\d+) with change date (.+)');
        });
        
        it('should extract Then attribute', () => {
            const line = '[Then(@"I should receive a successful response")]';
            const match = line.match(attributeRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('Then');
        });
        
        it('should handle attribute without @ prefix', () => {
            const line = '[When("I press add")]';
            const match = line.match(attributeRegex);
            
            expect(match).not.toBeNull();
            expect(match![2]).toBe('I press add');
        });
    });
    
    describe('method name extraction', () => {
        const methodRegex = /public\s+(?:async\s+)?(?:Task\s+|void\s+)(\w+)\s*\(/;
        
        it('should extract void method name', () => {
            const line = 'public void GivenIHaveAValidAccessToken()';
            const match = line.match(methodRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('GivenIHaveAValidAccessToken');
        });
        
        it('should extract async Task method name', () => {
            const line = 'public async Task WhenIRetrieveCryptoVariation(string currency)';
            const match = line.match(methodRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('WhenIRetrieveCryptoVariation');
        });
        
        it('should extract method with parameters', () => {
            const line = 'public void WhenIUpdateSalary(int salary, string date)';
            const match = line.match(methodRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('WhenIUpdateSalary');
        });
    });
    
    describe('class name extraction', () => {
        const classRegex = /class\s+(\w+)/;
        
        it('should extract simple class name', () => {
            const line = 'public class SalaryUpdateSteps';
            const match = line.match(classRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('SalaryUpdateSteps');
        });
        
        it('should extract class with inheritance', () => {
            const line = 'public class CryptoSteps : BaseSteps';
            const match = line.match(classRegex);
            
            expect(match).not.toBeNull();
            expect(match![1]).toBe('CryptoSteps');
        });
    });
});

describe('C# verbatim attribute extraction', () => {
    // Same pattern as csharpReqnrollProvider STEP_ATTRIBUTE: must allow "" inside string
    const STEP_ATTRIBUTE = /\[(Given|When|Then)\s*\(\s*(@?"(?:[^"\\]|\\.|"")*")\s*\)\]/g;
    function extractPattern(quotedString: string): string {
        let pattern = quotedString;
        if (pattern.startsWith('@"')) {
            pattern = pattern.slice(2, -1).replace(/""/g, '"');
        } else if (pattern.startsWith('"')) {
            pattern = pattern.slice(1, -1)
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
        }
        return pattern;
    }
    it('should capture full verbatim string when pattern contains "" (literal quote)', () => {
        const line = '[When(@"they click on ""(.*)"" in the menu")]';
        const match = line.match(STEP_ATTRIBUTE);
        expect(match).not.toBeNull();
        const inner = line.match(/\(\s*(@?"(?:[^"\\]|\\.|"")*")\s*\)/);
        expect(inner).not.toBeNull();
        const quoted = inner![1];
        expect(quoted).toBe('@"they click on ""(.*)"" in the menu"');
        const patternRaw = extractPattern(quoted);
        expect(patternRaw).toBe('they click on "(.*)" in the menu');
        expect(compileBindingRegex(patternRaw)!.test('they click on "Projects" in the menu')).toBe(true);
    });
});

describe('Pattern Compilation', () => {
    describe('GBM-style patterns', () => {
        it('should compile salary update pattern', () => {
            const pattern = 'I update the gross monthly income to (\\d+) with change date (.+)';
            const regex = compileBindingRegex(pattern);
            
            expect(regex).not.toBeNull();
            expect(regex!.test('I update the gross monthly income to 35000 with change date 2025-11')).toBe(true);
            expect(regex!.test('I update the gross monthly income to abc with change date 2025-11')).toBe(false);
        });
        
        it('should compile portfolio projection pattern', () => {
            const pattern = 'I request portfolio projection for (debt|balance|growth|settlement|preservation|appreciation|equities) with investment time (\\d+) years, first deposit (\\d+), and monthly deposit (\\d+)';
            const regex = compileBindingRegex(pattern);
            
            expect(regex).not.toBeNull();
            expect(regex!.test('I request portfolio projection for debt with investment time 5 years, first deposit 1000, and monthly deposit 1000')).toBe(true);
            expect(regex!.test('I request portfolio projection for invalid with investment time 5 years, first deposit 1000, and monthly deposit 1000')).toBe(false);
        });
        
        it('should compile crypto variation pattern', () => {
            const pattern = 'I retrieve crypto variation for currency "([^"]+)" and time period "([^"]+)"';
            const regex = compileBindingRegex(pattern);
            
            expect(regex).not.toBeNull();
            expect(regex!.test('I retrieve crypto variation for currency "MXN" and time period "one_day"')).toBe(true);
        });
        
        it('should compile freeform scenario pattern', () => {
            const pattern = 'I attempt to retrieve crypto variation (.+)';
            const regex = compileBindingRegex(pattern);
            
            expect(regex).not.toBeNull();
            expect(regex!.test('I attempt to retrieve crypto variation without time period')).toBe(true);
            expect(regex!.test('I attempt to retrieve crypto variation for currency "MXN" and invalid time period "invalid_period"')).toBe(true);
        });
    });
});

/**
 * Helper to parse Examples table lines.
 */
function parseExamplesTable(lines: string[]): { headers: string[], rows: string[][] } {
    const result: { headers: string[], rows: string[][] } = { headers: [], rows: [] };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|')) continue;
        
        const cells = line.slice(1, -1).split('|').map(c => c.trim());
        
        if (result.headers.length === 0) {
            result.headers = cells;
        } else {
            result.rows.push(cells);
        }
    }
    
    return result;
}
