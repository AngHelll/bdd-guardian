/**
 * Feature File Indexer
 * Parses .feature files to extract steps, tags, scenarios, and examples
 * 
 * IMPORTANT: This indexer now generates candidateTexts for each step,
 * which includes expanded Examples values for Scenario Outline steps.
 * This enables proper matching of steps with placeholders like <value>.
 */

import * as vscode from 'vscode';
import {
    FeatureFile,
    FeatureStep,
    ScenarioBlock,
    ExampleTable,
    StepKeyword,
    ResolvedKeyword,
    FeatureIndex,
    getConfig,
} from '../types';

// Step keyword regex
const STEP_KEYWORD_REGEX = /^\s*(Given|When|Then|And|But)\s+(.+)$/i;
const TAG_LINE_REGEX = /^\s*(@[\w-]+(?:\s+@[\w-]+)*)\s*$/;
const FEATURE_REGEX = /^\s*Feature:\s*(.+)$/i;
const BACKGROUND_REGEX = /^\s*Background:\s*(.*)$/i;
const SCENARIO_REGEX = /^\s*Scenario:\s*(.+)$/i;
const SCENARIO_OUTLINE_REGEX = /^\s*Scenario Outline:\s*(.+)$/i;
const EXAMPLES_REGEX = /^\s*Examples:\s*(.*)$/i;
const TABLE_ROW_REGEX = /^\s*\|(.+)\|\s*$/;

// Placeholder pattern: <placeholder>
const PLACEHOLDER_REGEX = /<([^>]+)>/g;

// Maximum example rows to expand (configurable)
const MAX_EXAMPLE_ROWS = 20;
// Maximum candidates per step
const MAX_CANDIDATES_PER_STEP = 25;

export class FeatureIndexer {
    private index: FeatureIndex = {
        features: new Map(),
        lastIndexed: new Date(0),
    };

    /**
     * Get the current feature index
     */
    public getIndex(): FeatureIndex {
        return this.index;
    }

    /**
     * Index all feature files in the workspace
     */
    public async indexAll(): Promise<void> {
        const config = getConfig();
        const featureFiles = await vscode.workspace.findFiles(
            config.featureGlob,
            `{${config.excludePatterns.join(',')}}`
        );

        this.index.features.clear();

        for (const uri of featureFiles) {
            await this.indexFile(uri);
        }

        this.index.lastIndexed = new Date();
        console.log(`[Reqnroll Navigator] Indexed ${this.index.features.size} feature files`);
    }

    /**
     * Index a single feature file
     */
    public async indexFile(uri: vscode.Uri): Promise<FeatureFile | undefined> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const featureFile = this.parseFeatureDocument(document);
            
            if (featureFile) {
                this.index.features.set(uri.toString(), featureFile);
            }
            
            return featureFile;
        } catch (error) {
            console.error(`[Reqnroll Navigator] Error indexing ${uri.fsPath}:`, error);
            return undefined;
        }
    }

    /**
     * Remove a file from the index
     */
    public removeFile(uri: vscode.Uri): void {
        this.index.features.delete(uri.toString());
    }

    /**
     * Parse a feature document
     */
    private parseFeatureDocument(document: vscode.TextDocument): FeatureFile | undefined {
        const lines = document.getText().split('\n');
        
        let featureName = '';
        let featureTags: string[] = [];
        const backgroundSteps: FeatureStep[] = [];
        const scenarios: ScenarioBlock[] = [];
        const allSteps: FeatureStep[] = [];
        
        let pendingTags: string[] = [];
        let currentScenario: ScenarioBlock | null = null;
        let currentExamples: ExampleTable | null = null;
        let inBackground = false;
        let lastResolvedKeyword: ResolvedKeyword = 'Given';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            // Parse tags
            const tagMatch = trimmedLine.match(TAG_LINE_REGEX);
            if (tagMatch) {
                const tags = tagMatch[1].split(/\s+/).filter(t => t.startsWith('@'));
                pendingTags.push(...tags);
                continue;
            }

            // Parse Feature:
            const featureMatch = trimmedLine.match(FEATURE_REGEX);
            if (featureMatch) {
                featureName = featureMatch[1].trim();
                featureTags = [...pendingTags];
                pendingTags = [];
                continue;
            }

            // Parse Background:
            const backgroundMatch = trimmedLine.match(BACKGROUND_REGEX);
            if (backgroundMatch) {
                inBackground = true;
                currentScenario = null;
                currentExamples = null;
                lastResolvedKeyword = 'Given';
                pendingTags = [];
                continue;
            }

            // Parse Scenario:
            const scenarioMatch = trimmedLine.match(SCENARIO_REGEX);
            if (scenarioMatch) {
                inBackground = false;
                currentExamples = null;
                lastResolvedKeyword = 'Given';
                
                currentScenario = {
                    type: 'Scenario',
                    name: scenarioMatch[1].trim(),
                    tags: [...pendingTags],
                    steps: [],
                    examples: [],
                    range: new vscode.Range(i, 0, i, line.length),
                };
                scenarios.push(currentScenario);
                pendingTags = [];
                continue;
            }

            // Parse Scenario Outline:
            const outlineMatch = trimmedLine.match(SCENARIO_OUTLINE_REGEX);
            if (outlineMatch) {
                inBackground = false;
                currentExamples = null;
                lastResolvedKeyword = 'Given';
                
                currentScenario = {
                    type: 'Scenario Outline',
                    name: outlineMatch[1].trim(),
                    tags: [...pendingTags],
                    steps: [],
                    examples: [],
                    range: new vscode.Range(i, 0, i, line.length),
                };
                scenarios.push(currentScenario);
                pendingTags = [];
                continue;
            }

            // Parse Examples:
            const examplesMatch = trimmedLine.match(EXAMPLES_REGEX);
            if (examplesMatch && currentScenario?.type === 'Scenario Outline') {
                currentExamples = {
                    headers: [],
                    rows: [],
                    tags: [...pendingTags],
                };
                currentScenario.examples.push(currentExamples);
                pendingTags = [];
                continue;
            }

            // Parse table rows (for Examples)
            const tableMatch = trimmedLine.match(TABLE_ROW_REGEX);
            if (tableMatch && currentExamples) {
                const cells = tableMatch[1].split('|').map(c => c.trim());
                
                if (currentExamples.headers.length === 0) {
                    currentExamples.headers = cells;
                } else {
                    const config = getConfig();
                    if (currentExamples.rows.length < (config.maxExampleRows || MAX_EXAMPLE_ROWS)) {
                        currentExamples.rows.push(cells);
                    }
                }
                continue;
            }

            // Parse step lines
            const stepMatch = trimmedLine.match(STEP_KEYWORD_REGEX);
            if (stepMatch) {
                const keywordOriginal = this.normalizeKeyword(stepMatch[1]);
                const stepText = stepMatch[2].trim();
                
                // Resolve And/But to previous keyword
                let keywordResolved: ResolvedKeyword;
                if (keywordOriginal === 'And' || keywordOriginal === 'But') {
                    keywordResolved = lastResolvedKeyword;
                } else {
                    keywordResolved = keywordOriginal as ResolvedKeyword;
                    lastResolvedKeyword = keywordResolved;
                }

                // Compute tags in scope
                const tagsInScope = [...featureTags];
                if (currentScenario) {
                    tagsInScope.push(...currentScenario.tags);
                }

                // Get examples for Scenario Outline
                const stepExamples = currentScenario?.type === 'Scenario Outline' 
                    ? currentScenario.examples 
                    : undefined;

                const step: FeatureStep = {
                    keywordOriginal,
                    keywordResolved,
                    stepText,
                    fullText: trimmedLine,
                    tagsInScope,
                    uri: document.uri,
                    range: new vscode.Range(i, 0, i, line.length),
                    lineNumber: i,
                    scenarioName: currentScenario?.name,
                    examples: stepExamples,
                };

                if (inBackground) {
                    backgroundSteps.push(step);
                } else if (currentScenario) {
                    currentScenario.steps.push(step);
                }

                allSteps.push(step);
            }
        }

        if (!featureName) {
            return undefined;
        }

        return {
            uri: document.uri,
            featureName,
            featureTags,
            backgroundSteps,
            scenarios,
            allSteps,
        };
    }

    /**
     * Normalize keyword to proper case
     */
    private normalizeKeyword(keyword: string): StepKeyword {
        const lower = keyword.toLowerCase();
        switch (lower) {
            case 'given': return 'Given';
            case 'when': return 'When';
            case 'then': return 'Then';
            case 'and': return 'And';
            case 'but': return 'But';
            default: return 'Given';
        }
    }

    /**
     * Get all steps from all indexed features
     */
    public getAllSteps(): FeatureStep[] {
        const steps: FeatureStep[] = [];
        for (const feature of this.index.features.values()) {
            steps.push(...feature.allSteps);
        }
        return steps;
    }

    /**
     * Get feature file by URI
     */
    public getFeatureByUri(uri: vscode.Uri): FeatureFile | undefined {
        return this.index.features.get(uri.toString());
    }

    /**
     * Get step at a specific position
     */
    public getStepAtPosition(uri: vscode.Uri, position: vscode.Position): FeatureStep | undefined {
        const feature = this.getFeatureByUri(uri);
        if (!feature) {
            return undefined;
        }

        return feature.allSteps.find(step =>
            step.lineNumber === position.line
        );
    }
}

// ════════════════════════════════════════════════════════════════════════════
// CANDIDATE TEXT GENERATION (for resolving steps with Examples)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate candidate texts for a step for matching.
 * 
 * For Scenario Outline steps with <placeholders>:
 * - Generates expanded texts using values from Examples tables
 * - Limited to MAX_CANDIDATES_PER_STEP to prevent memory bloat
 * - Always includes a fallback candidate with placeholders replaced by "X"
 * 
 * For regular steps:
 * - Returns a single candidate with normalized whitespace
 * 
 * @example
 * Step: When I enter <amount> into the calculator
 * Examples: | amount | → | 50 |, | 100 |
 * Candidates: ["When I enter X into the calculator", "When I enter 50 into the calculator", "When I enter 100 into the calculator"]
 */
export function generateCandidateTexts(step: FeatureStep): string[] {
    const candidates: string[] = [];
    const normalizedText = normalizeWhitespace(step.stepText);
    
    // Check if text contains placeholders
    const hasPlaceholders = /<[^>]+>/.test(normalizedText);
    
    // Fallback candidate: replace <placeholder> with "X"
    const fallbackCandidate = normalizedText.replace(/<[^>]+>/g, 'X');
    candidates.push(fallbackCandidate);
    
    // If no placeholders or no examples, return just the fallback
    if (!hasPlaceholders || !step.examples || step.examples.length === 0) {
        return candidates;
    }
    
    // Expand placeholders with actual values from Examples
    for (const example of step.examples) {
        if (example.headers.length === 0) continue;
        
        // Calculate how many rows we can process
        const remainingSlots = MAX_CANDIDATES_PER_STEP - candidates.length;
        if (remainingSlots <= 0) break;
        
        const maxRows = Math.min(example.rows.length, remainingSlots);
        
        for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
            const row = example.rows[rowIdx];
            let expandedText = normalizedText;
            
            // Replace each placeholder with the corresponding value
            for (let colIdx = 0; colIdx < example.headers.length; colIdx++) {
                const placeholder = `<${example.headers[colIdx]}>`;
                const value = row[colIdx] ?? 'X';
                
                // Replace all occurrences of this placeholder
                // Use a regex to handle case where placeholder might have special chars
                expandedText = expandedText.split(placeholder).join(value);
            }
            
            // Normalize the expanded text
            expandedText = normalizeWhitespace(expandedText);
            
            // Add if unique and not same as fallback
            if (!candidates.includes(expandedText)) {
                candidates.push(expandedText);
            }
        }
    }
    
    return candidates;
}

/**
 * Normalize whitespace in text: trim and collapse multiple spaces/tabs to single space.
 * Does not alter quotes or other characters.
 */
export function normalizeWhitespace(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
}

/**
 * Check if a step has placeholders (is from Scenario Outline)
 */
export function hasPlaceholders(stepText: string): boolean {
    return /<[^>]+>/.test(stepText);
}

/**
 * Extract placeholder names from step text
 * @returns Array of placeholder names (without < >)
 */
export function extractPlaceholders(text: string): string[] {
    const placeholders: string[] = [];
    let match;
    const regex = /<([^>]+)>/g;
    
    while ((match = regex.exec(text)) !== null) {
        placeholders.push(match[1]);
    }
    
    return placeholders;
}
