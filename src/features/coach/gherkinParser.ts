/**
 * Lightweight Gherkin Parser for Coach Mode
 * Parses .feature files line-by-line without heavy dependencies.
 */

import * as vscode from 'vscode';
import {
    GherkinModel,
    GherkinScenario,
    GherkinBackground,
    GherkinStep,
    GherkinExamples,
} from './rules/types';

// Regex patterns for Gherkin keywords
const FEATURE_REGEX = /^\s*Feature:\s*(.*)$/i;
const SCENARIO_REGEX = /^\s*Scenario:\s*(.*)$/i;
const SCENARIO_OUTLINE_REGEX = /^\s*Scenario Outline:\s*(.*)$/i;
const BACKGROUND_REGEX = /^\s*Background:\s*$/i;
const EXAMPLES_REGEX = /^\s*Examples:\s*(.*)$/i;
const STEP_REGEX = /^\s*(Given|When|Then|And|But)\s+(.+)$/i;
const TAG_REGEX = /^\s*(@\S+)/g;
const TABLE_ROW_REGEX = /^\s*\|(.+)\|\s*$/;

/**
 * Parse a .feature document into a GherkinModel.
 */
export function parseGherkinDocument(document: vscode.TextDocument): GherkinModel {
    const model: GherkinModel = {
        scenarios: [],
        featureTags: [],
    };
    
    const lines = document.getText().split('\n');
    let currentScenario: GherkinScenario | null = null;
    let currentBackground: GherkinBackground | null = null;
    let currentExamples: GherkinExamples | null = null;
    let pendingTags: string[] = [];
    let lastKeyword: 'Given' | 'When' | 'Then' = 'Given';
    let inExamplesTable = false;
    let examplesHeadersParsed = false;
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }
        
        // Parse tags
        const tagMatches = trimmedLine.match(/@\S+/g);
        if (tagMatches && !STEP_REGEX.test(trimmedLine)) {
            pendingTags.push(...tagMatches);
            continue;
        }
        
        // Parse Feature
        const featureMatch = trimmedLine.match(FEATURE_REGEX);
        if (featureMatch) {
            model.featureTitle = featureMatch[1].trim();
            model.featureLine = lineNum;
            model.featureTags = [...pendingTags];
            pendingTags = [];
            continue;
        }
        
        // Parse Background
        const backgroundMatch = trimmedLine.match(BACKGROUND_REGEX);
        if (backgroundMatch) {
            // Save current scenario if any
            if (currentScenario) {
                if (currentExamples) {
                    currentScenario.examples.push(currentExamples);
                }
                model.scenarios.push(currentScenario);
                currentScenario = null;
            }
            
            currentBackground = {
                line: lineNum,
                steps: [],
            };
            lastKeyword = 'Given';
            pendingTags = [];
            inExamplesTable = false;
            continue;
        }
        
        // Parse Scenario Outline
        const outlineMatch = trimmedLine.match(SCENARIO_OUTLINE_REGEX);
        if (outlineMatch) {
            // Save current scenario/background
            if (currentScenario) {
                if (currentExamples) {
                    currentScenario.examples.push(currentExamples);
                }
                model.scenarios.push(currentScenario);
            }
            if (currentBackground) {
                model.background = currentBackground;
                currentBackground = null;
            }
            
            currentScenario = {
                title: outlineMatch[1].trim(),
                line: lineNum,
                isOutline: true,
                steps: [],
                examples: [],
                tags: [...pendingTags],
            };
            pendingTags = [];
            lastKeyword = 'Given';
            currentExamples = null;
            inExamplesTable = false;
            continue;
        }
        
        // Parse Scenario
        const scenarioMatch = trimmedLine.match(SCENARIO_REGEX);
        if (scenarioMatch) {
            // Save current scenario/background
            if (currentScenario) {
                if (currentExamples) {
                    currentScenario.examples.push(currentExamples);
                }
                model.scenarios.push(currentScenario);
            }
            if (currentBackground) {
                model.background = currentBackground;
                currentBackground = null;
            }
            
            currentScenario = {
                title: scenarioMatch[1].trim(),
                line: lineNum,
                isOutline: false,
                steps: [],
                examples: [],
                tags: [...pendingTags],
            };
            pendingTags = [];
            lastKeyword = 'Given';
            currentExamples = null;
            inExamplesTable = false;
            continue;
        }
        
        // Parse Examples
        const examplesMatch = trimmedLine.match(EXAMPLES_REGEX);
        if (examplesMatch && currentScenario?.isOutline) {
            // Save previous examples if any
            if (currentExamples) {
                currentScenario.examples.push(currentExamples);
            }
            
            currentExamples = {
                line: lineNum,
                headers: [],
                rowCount: 0,
                tags: [...pendingTags],
            };
            pendingTags = [];
            inExamplesTable = true;
            examplesHeadersParsed = false;
            continue;
        }
        
        // Parse table rows (for Examples)
        const tableMatch = trimmedLine.match(TABLE_ROW_REGEX);
        if (tableMatch && inExamplesTable && currentExamples) {
            const cells = tableMatch[1].split('|').map(c => c.trim());
            if (!examplesHeadersParsed) {
                currentExamples.headers = cells;
                examplesHeadersParsed = true;
            } else {
                currentExamples.rowCount++;
            }
            continue;
        }
        
        // Parse steps
        const stepMatch = trimmedLine.match(STEP_REGEX);
        if (stepMatch) {
            const keyword = stepMatch[1];
            const text = stepMatch[2];
            
            // Resolve And/But to the last Given/When/Then
            let keywordResolved: 'Given' | 'When' | 'Then';
            const keywordLower = keyword.toLowerCase();
            if (keywordLower === 'given') {
                keywordResolved = 'Given';
                lastKeyword = 'Given';
            } else if (keywordLower === 'when') {
                keywordResolved = 'When';
                lastKeyword = 'When';
            } else if (keywordLower === 'then') {
                keywordResolved = 'Then';
                lastKeyword = 'Then';
            } else {
                // And/But inherit from last keyword
                keywordResolved = lastKeyword;
            }
            
            const step: GherkinStep = {
                keyword,
                keywordResolved,
                text,
                fullText: trimmedLine,
                line: lineNum,
            };
            
            // Add to current context
            if (currentScenario) {
                currentScenario.steps.push(step);
                inExamplesTable = false;
            } else if (currentBackground) {
                currentBackground.steps.push(step);
            }
            continue;
        }
    }
    
    // Save final scenario
    if (currentScenario) {
        if (currentExamples) {
            currentScenario.examples.push(currentExamples);
        }
        model.scenarios.push(currentScenario);
    }
    if (currentBackground) {
        model.background = currentBackground;
    }
    
    return model;
}
