/**
 * Java Cucumber Binding Provider (Stub)
 * 
 * Placeholder for future Cucumber-JVM support.
 */

import * as vscode from 'vscode';
import {
    IBindingProvider,
    BindingProviderId,
    DetectionResult,
    BindingIndexOptions,
    NOT_IMPLEMENTED_DETECTION,
} from './types';
import { Binding } from '../../core/domain';

/**
 * Java Cucumber Binding Provider (Stub)
 */
export class JavaCucumberProvider implements IBindingProvider {
    public readonly id: BindingProviderId = 'java-cucumber';
    public readonly displayName = 'Java Cucumber';
    public readonly bindingFileExtensions = ['.java'];
    public readonly bindingGlob = '**/*.java';
    
    async detect(_workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<DetectionResult> {
        // TODO: Implement Cucumber-JVM detection
        // Signals: cucumber-java in pom.xml/build.gradle, @Given/@When/@Then annotations
        return NOT_IMPLEMENTED_DETECTION;
    }
    
    async indexBindings(
        _files: readonly vscode.Uri[],
        _options?: BindingIndexOptions
    ): Promise<Binding[]> {
        // TODO: Implement Java Cucumber binding parsing
        // Look for: @Given("pattern"), @When("pattern"), @Then("pattern")
        return [];
    }
    
    parseFile(
        _document: vscode.TextDocument,
        _options?: BindingIndexOptions
    ): Binding[] {
        return [];
    }
}

let instance: JavaCucumberProvider | null = null;

export function getJavaCucumberProvider(): JavaCucumberProvider {
    if (!instance) {
        instance = new JavaCucumberProvider();
    }
    return instance;
}
