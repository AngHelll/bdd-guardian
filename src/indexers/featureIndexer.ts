/**
 * Feature File Indexer
 * Parses .feature files to extract steps, tags, scenarios, and examples
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
                    if (currentExamples.rows.length < config.maxExampleRows) {
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
                    examples: currentScenario?.type === 'Scenario Outline' ? currentScenario.examples : undefined,
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
