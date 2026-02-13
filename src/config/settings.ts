/**
 * Settings
 * Configuration management with caching and change detection
 */

import * as vscode from 'vscode';
import { ExtensionConfig, TagFilterConfig, TagFilterMode, FeatureStep } from '../core/domain/types';
import { DEFAULT_CONFIG } from '../core/domain/constants';

/** Cached configuration */
let cachedConfig: ExtensionConfig | null = null;

/**
 * Get the current extension configuration
 * Uses caching for performance
 */
export function getConfig(): ExtensionConfig {
    if (cachedConfig) {
        return cachedConfig;
    }
    
    const config = vscode.workspace.getConfiguration('reqnrollNavigator');
    
    cachedConfig = {
        caseInsensitive: config.get('caseInsensitive', DEFAULT_CONFIG.caseInsensitive),
        tagFilter: config.get('tagFilter', DEFAULT_CONFIG.tagFilter),
        tagFilterMode: config.get('tagFilterMode', DEFAULT_CONFIG.tagFilterMode) as TagFilterMode,
        featureGlob: config.get('featureGlob', DEFAULT_CONFIG.featureGlob),
        bindingsGlob: config.get('bindingsGlob', DEFAULT_CONFIG.bindingsGlob),
        excludePatterns: config.get('excludePatterns', DEFAULT_CONFIG.excludePatterns),
        maxExampleRows: config.get('maxExampleRows', DEFAULT_CONFIG.maxExampleRows),
        enableCodeLens: config.get('enableCodeLens', DEFAULT_CONFIG.enableCodeLens),
        enableDiagnostics: config.get('enableDiagnostics', DEFAULT_CONFIG.enableDiagnostics),
        enableDecorations: config.get('enableDecorations', DEFAULT_CONFIG.enableDecorations),
        debug: config.get('debug', DEFAULT_CONFIG.debug),
        maxFilesIndexed: config.get('maxFilesIndexed', 5000),
    };
    
    return cachedConfig;
}

/**
 * Invalidate the cached configuration
 * Call this when configuration changes
 */
export function invalidateConfigCache(): void {
    cachedConfig = null;
}

/**
 * Get tag filter configuration
 */
export function getTagFilterConfig(): TagFilterConfig {
    const config = getConfig();
    return {
        tags: config.tagFilter,
        mode: config.tagFilterMode,
    };
}

/**
 * Check if a step should be shown based on tag filter configuration
 * This affects ONLY CodeLens and Diagnostics - NOT navigation
 * 
 * @param tagsEffective The effective tags for the step (feature + scenario tags)
 * @param filterConfig The tag filter configuration
 * @returns true if the step should be shown
 */
export function shouldShowStep(tagsEffective: readonly string[], filterConfig?: TagFilterConfig): boolean {
    const config = filterConfig ?? getTagFilterConfig();
    
    // If no filter tags, show everything
    if (!config.tags || config.tags.length === 0) {
        return true;
    }

    // Check if step has any matching tag (case-insensitive)
    const stepTagsLower = tagsEffective.map(t => t.toLowerCase());
    const filterTagsLower = config.tags.map(t => t.toLowerCase());
    
    const hasMatchingTag = filterTagsLower.some(filterTag => 
        stepTagsLower.includes(filterTag)
    );

    // Apply filter mode
    if (config.mode === 'include') {
        // Include mode: only show steps with matching tags
        return hasMatchingTag;
    } else {
        // Exclude mode: hide steps with matching tags
        return !hasMatchingTag;
    }
}

/**
 * Filter an array of steps based on tag configuration
 * Use this for CodeLens and Diagnostics, NOT for navigation
 */
export function filterStepsByTags(steps: readonly FeatureStep[], filterConfig?: TagFilterConfig): FeatureStep[] {
    const config = filterConfig ?? getTagFilterConfig();
    
    // If no filter, return all steps
    if (!config.tags || config.tags.length === 0) {
        return [...steps];
    }
    
    return steps.filter(step => shouldShowStep(step.tagsEffective, config));
}

/**
 * Create a disposable that listens for configuration changes
 */
export function createConfigChangeListener(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('reqnrollNavigator')) {
            invalidateConfigCache();
            callback();
        }
    });
}
