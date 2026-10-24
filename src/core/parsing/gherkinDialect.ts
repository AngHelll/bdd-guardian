/**
 * Per-file Gherkin dialect from a snapshot of
 * https://github.com/cucumber/gherkin/blob/e80e750e6b8dc6c2258330675204e8672a33f951/gherkin-languages.json
 *
 * Step keywords match only when whitespace follows, same as the English parser.
 */

import type { StepKeyword } from '../domain/types';
import languages from './gherkin-languages.json';

export interface GherkinLanguageTable {
    readonly feature: readonly string[];
    readonly rule: readonly string[];
    readonly background: readonly string[];
    readonly scenario: readonly string[];
    readonly scenarioOutline: readonly string[];
    readonly examples: readonly string[];
    readonly given: readonly string[];
    readonly when: readonly string[];
    readonly then: readonly string[];
    readonly and: readonly string[];
    readonly but: readonly string[];
}

export interface GherkinMatchPatterns {
    readonly feature: RegExp;
    readonly rule: RegExp;
    readonly background: RegExp;
    readonly scenarioOutline: RegExp;
    readonly scenario: RegExp;
    readonly examples: RegExp;
    readonly step: RegExp;
    roleOf(keyword: string): StepKeyword;
}

export interface EnglishGherkinKeywords {
    readonly step: readonly string[];
    readonly feature: readonly string[];
    readonly rule: readonly string[];
    readonly background: readonly string[];
    readonly scenario: readonly string[];
    readonly scenarioOutline: readonly string[];
    readonly examples: readonly string[];
}

const LANGUAGE_HEADER = /^#\s*language\s*:\s*([a-zA-Z]{2,}(?:-[a-zA-Z0-9]+)*)\s*$/i;

const STEP_ROLES: ReadonlyArray<readonly [keyof GherkinLanguageTable, StepKeyword]> = [
    ['given', 'Given'],
    ['when', 'When'],
    ['then', 'Then'],
    ['and', 'And'],
    ['but', 'But'],
];

const tables = new Map<string, GherkinLanguageTable>();
for (const [code, table] of Object.entries(languages)) {
    tables.set(code.toLowerCase(), table as GherkinLanguageTable);
}

const patternCache = new Map<string, GherkinMatchPatterns>();

function cleanKeyword(raw: string): string {
    const keyword = raw.trim();
    return keyword === '*' ? '' : keyword;
}

function keywordsOf(raw: readonly string[]): string[] {
    const seen = new Set<string>();
    const keywords: string[] = [];
    for (const entry of raw) {
        const keyword = cleanKeyword(entry);
        if (!keyword || seen.has(keyword)) {
            continue;
        }
        seen.add(keyword);
        keywords.push(keyword);
    }
    return keywords;
}

function escapeRegex(keyword: string): string {
    return keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function alternation(keywords: readonly string[]): string {
    if (keywords.length === 0) {
        return '(?!)';
    }
    return [...keywords]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex)
        .join('|');
}

function headerPattern(keywords: readonly string[], name: 'required' | 'optional'): RegExp {
    const nameGroup = name === 'required' ? '(.+)' : '(.*)';
    return new RegExp(`^\\s*(?:${alternation(keywords)}):\\s*${nameGroup}$`, 'i');
}

function tableFor(code: string | undefined): GherkinLanguageTable {
    if (code) {
        const table = tables.get(code.toLowerCase());
        if (table) {
            return table;
        }
    }
    const english = tables.get('en');
    if (!english) {
        throw new Error('Gherkin language table is missing "en"');
    }
    return english;
}

function patternsForTable(table: GherkinLanguageTable): GherkinMatchPatterns {
    const feature = keywordsOf(table.feature);
    const rule = keywordsOf(table.rule);
    const background = keywordsOf(table.background);
    const scenario = keywordsOf(table.scenario);
    const scenarioOutline = keywordsOf(table.scenarioOutline);
    const examples = keywordsOf(table.examples);

    const roleByKeyword = new Map<string, StepKeyword>();
    const stepKeywords: string[] = [];
    const seenSteps = new Set<string>();
    for (const [field, role] of STEP_ROLES) {
        for (const keyword of keywordsOf(table[field])) {
            roleByKeyword.set(keyword.toLowerCase(), role);
            if (!seenSteps.has(keyword)) {
                seenSteps.add(keyword);
                stepKeywords.push(keyword);
            }
        }
    }
    stepKeywords.push('*');

    return {
        feature: headerPattern(feature, 'required'),
        rule: headerPattern(rule, 'optional'),
        background: headerPattern(background, 'optional'),
        scenarioOutline: headerPattern(scenarioOutline, 'required'),
        scenario: headerPattern(scenario, 'required'),
        examples: headerPattern(examples, 'optional'),
        step: new RegExp(`^\\s*(${alternation(stepKeywords)})\\s+(.+)$`, 'i'),
        roleOf(keyword: string): StepKeyword {
            if (keyword.trim() === '*') {
                return '*';
            }
            return roleByKeyword.get(keyword.trim().toLowerCase()) ?? 'Given';
        },
    };
}

/** Dialect code on the first line, after an optional UTF-8 BOM. */
export function gherkinLanguageCode(text: string): string | undefined {
    const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
    return firstLine.match(LANGUAGE_HEADER)?.[1];
}

export function gherkinPatternsForText(text: string): GherkinMatchPatterns {
    const code = gherkinLanguageCode(text)?.toLowerCase() ?? 'en';
    const cacheKey = tables.has(code) ? code : 'en';
    const cached = patternCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const patterns = patternsForTable(tableFor(cacheKey));
    patternCache.set(cacheKey, patterns);
    return patterns;
}

const englishTable = tableFor('en');
const englishPatterns = patternsForTable(englishTable);
patternCache.set('en', englishPatterns);

export const englishGherkinPatterns: GherkinMatchPatterns = englishPatterns;

export const englishGherkinKeywords: EnglishGherkinKeywords = {
    step: ['*', ...keywordsOf([
        ...englishTable.given,
        ...englishTable.when,
        ...englishTable.then,
        ...englishTable.and,
        ...englishTable.but,
    ])],
    feature: keywordsOf(englishTable.feature),
    rule: keywordsOf(englishTable.rule),
    background: keywordsOf(englishTable.background),
    scenario: keywordsOf(englishTable.scenario),
    scenarioOutline: keywordsOf(englishTable.scenarioOutline),
    examples: keywordsOf(englishTable.examples),
};
