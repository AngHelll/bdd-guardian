/**
 * Document Symbol Provider (Outline)
 * Provides hierarchical outline for feature files
 * 
 * Structure:
 * 📄 Feature: Login functionality
 *   📋 Background
 *     → Given the app is running
 *   🎬 Scenario: Successful login
 *     → Given I am on the login page
 *     → When I enter valid credentials
 *     → Then I should see the dashboard
 *   🔄 Scenario Outline: Login with different users
 *     → Given I am logged in as "<role>"
 *     📊 Examples: Admin users
 *     📊 Examples: Regular users
 */

import * as vscode from 'vscode';
import { FeatureIndexer } from '../indexers/featureIndexer';

/**
 * Provides document symbols for feature file outline
 */
export class FeatureOutlineProvider implements vscode.DocumentSymbolProvider {
    constructor(private featureIndexer: FeatureIndexer) {}

    /**
     * Provide document symbols for the outline view
     */
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        // Only process feature files
        if (document.languageId !== 'gherkin' && !document.fileName.endsWith('.feature')) {
            return [];
        }

        const feature = this.featureIndexer.getFeatureByUri(document.uri);
        if (!feature) {
            return [];
        }

        const symbols: vscode.DocumentSymbol[] = [];

        // Create Feature symbol as root
        const featureRange = new vscode.Range(0, 0, document.lineCount - 1, 0);
        const featureSymbol = new vscode.DocumentSymbol(
            `Feature: ${feature.featureName}`,
            feature.featureTags.length > 0 ? feature.featureTags.join(' ') : '',
            vscode.SymbolKind.Module,
            featureRange,
            featureRange
        );

        // Add Background if present
        if (feature.backgroundSteps.length > 0) {
            const bgSymbol = this.createBackgroundSymbol(feature.backgroundSteps);
            if (bgSymbol) {
                featureSymbol.children.push(bgSymbol);
            }
        }

        // Add Scenarios
        for (const scenario of feature.scenarios) {
            const scenarioSymbol = this.createScenarioSymbol(scenario);
            featureSymbol.children.push(scenarioSymbol);
        }

        symbols.push(featureSymbol);
        return symbols;
    }

    /**
     * Create symbol for Background block
     */
    private createBackgroundSymbol(
        steps: { range: vscode.Range; keywordOriginal: string; stepText: string }[]
    ): vscode.DocumentSymbol | null {
        if (steps.length === 0) return null;

        const firstStep = steps[0];
        const lastStep = steps[steps.length - 1];

        const bgRange = new vscode.Range(
            firstStep.range.start.line - 1, 0,
            lastStep.range.end.line, 0
        );

        const bgSymbol = new vscode.DocumentSymbol(
            '📋 Background',
            `${steps.length} steps`,
            vscode.SymbolKind.Constructor,
            bgRange,
            bgRange
        );

        // Add step children
        for (const step of steps) {
            const stepSymbol = this.createStepSymbol(step);
            bgSymbol.children.push(stepSymbol);
        }

        return bgSymbol;
    }

    /**
     * Create symbol for Scenario/Scenario Outline
     */
    private createScenarioSymbol(scenario: {
        type: 'Scenario' | 'Scenario Outline';
        name: string;
        tags: string[];
        steps: { range: vscode.Range; keywordOriginal: string; stepText: string }[];
        examples: { headers: string[]; rows: string[][]; tags: string[] }[];
        range: vscode.Range;
    }): vscode.DocumentSymbol {
        const icon = scenario.type === 'Scenario Outline' ? '🔄' : '🎬';
        const kind = scenario.type === 'Scenario Outline' 
            ? vscode.SymbolKind.Class 
            : vscode.SymbolKind.Method;

        const scenarioSymbol = new vscode.DocumentSymbol(
            `${icon} ${scenario.name}`,
            scenario.tags.length > 0 ? scenario.tags.join(' ') : '',
            kind,
            scenario.range,
            scenario.range
        );

        // Add step children
        for (const step of scenario.steps) {
            const stepSymbol = this.createStepSymbol(step);
            scenarioSymbol.children.push(stepSymbol);
        }

        // Add Examples (for Scenario Outline)
        if (scenario.examples.length > 0) {
            for (let i = 0; i < scenario.examples.length; i++) {
                const example = scenario.examples[i];
                const exampleSymbol = this.createExampleSymbol(example, i);
                scenarioSymbol.children.push(exampleSymbol);
            }
        }

        return scenarioSymbol;
    }

    /**
     * Create symbol for a step
     */
    private createStepSymbol(step: {
        range: vscode.Range;
        keywordOriginal: string;
        stepText: string;
    }): vscode.DocumentSymbol {
        const keyword = step.keywordOriginal;
        const icon = this.getStepIcon(keyword);

        return new vscode.DocumentSymbol(
            `${icon} ${keyword} ${step.stepText}`,
            '',
            vscode.SymbolKind.Event,
            step.range,
            step.range
        );
    }

    /**
     * Create symbol for Examples table
     */
    private createExampleSymbol(
        example: { headers: string[]; rows: string[][]; tags: string[] },
        index: number
    ): vscode.DocumentSymbol {
        const name = example.tags.length > 0 
            ? `📊 Examples ${example.tags.join(' ')}`
            : `📊 Examples #${index + 1}`;
        
        const detail = `${example.rows.length} rows × ${example.headers.length} columns`;

        // Create a placeholder range (we don't have exact line info for examples)
        const placeholderRange = new vscode.Range(0, 0, 0, 0);

        return new vscode.DocumentSymbol(
            name,
            detail,
            vscode.SymbolKind.Array,
            placeholderRange,
            placeholderRange
        );
    }

    /**
     * Get icon for step keyword
     */
    private getStepIcon(keyword: string): string {
        switch (keyword.toLowerCase()) {
            case 'given': return '📥';
            case 'when': return '⚡';
            case 'then': return '✅';
            case 'and': return '➕';
            case 'but': return '➖';
            default: return '→';
        }
    }
}
