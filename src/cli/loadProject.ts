/**
 * Headless project load — walk filesystem, parse features/bindings (no vscode import).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { parseJsCucumberBindingsFromText } from '../core/parsing/jsCucumberBindingParser';
import { parsePythonBehaveBindingsFromText } from '../core/parsing/pythonBehaveBindingParser';
import { parseGoGodogBindingsFromText } from '../core/parsing/goGodogBindingParser';
import { parseJavaCucumberBindingsFromText } from '../core/parsing/javaCucumberBindingParser';
import type { Binding, FeatureDocument } from '../core/domain/types';
import type { BindingProviderId } from '../providers/bindings/types';
import { fileUri, makeTextDocument } from './textDocument';

const EXCLUDE_DIR_NAMES = new Set([
    'node_modules',
    'bin',
    'obj',
    '.git',
    'out',
    'dist',
    '.vs',
    'target',
    'vendor',
    '__pycache__',
]);

const MAX_FILES = 5000;

export interface LoadedBinding {
    readonly binding: Binding;
    readonly providerId: BindingProviderId;
}

export interface LoadedProject {
    readonly projectDir: string;
    readonly features: FeatureDocument[];
    readonly bindings: LoadedBinding[];
    readonly providersDetected: BindingProviderId[];
    readonly featurePaths: string[];
    readonly bindingPaths: string[];
}

export function toPosixRelative(projectDir: string, absPath: string): string {
    return path.relative(projectDir, absPath).split(path.sep).join('/');
}

export function walkProjectFiles(projectDir: string): string[] {
    const root = path.resolve(projectDir);
    const results: string[] = [];

    function walk(dir: string): void {
        if (results.length >= MAX_FILES) {
            return;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (results.length >= MAX_FILES) {
                return;
            }
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (EXCLUDE_DIR_NAMES.has(entry.name)) {
                    continue;
                }
                walk(full);
                continue;
            }
            if (entry.isFile()) {
                results.push(full);
            }
        }
    }

    walk(root);
    return results;
}

function isFeaturePath(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.feature');
}

function isLikelyBindingPath(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.cs')) {
        return true;
    }
    if (lower.endsWith('.java')) {
        return lower.includes('step') || lower.includes('/test/') || lower.includes('\\test\\');
    }
    if (lower.endsWith('.py')) {
        return lower.includes('step') || lower.includes('/features/');
    }
    if (lower.endsWith('.go')) {
        return lower.endsWith('_test.go') || lower.includes('step') || lower.includes('/features/');
    }
    if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
        if (lower.endsWith('.d.ts')) {
            return false;
        }
        return (
            lower.includes('step') ||
            lower.includes('step_definitions') ||
            lower.includes('stepdefinitions')
        );
    }
    return false;
}

function detectCsharpProvider(text: string): BindingProviderId {
    if (/TechTalk\.SpecFlow|\bSpecFlow\b/.test(text) && !/\bReqnroll\b/.test(text)) {
        return 'csharp-specflow';
    }
    return 'csharp-reqnroll';
}

function parseBindingsForFile(
    absPath: string,
    text: string
): { providerId: BindingProviderId; bindings: Binding[] } | null {
    const lower = absPath.toLowerCase();
    const uri = fileUri(absPath) as never;

    try {
        if (lower.endsWith('.cs')) {
            const providerId = detectCsharpProvider(text);
            return { providerId, bindings: parseCSharpBindingsFromText(text, uri) };
        }
        if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
            const bindings = parseJsCucumberBindingsFromText(text, uri);
            if (bindings.length === 0) {
                return null;
            }
            return { providerId: 'js-cucumber', bindings };
        }
        if (lower.endsWith('.py')) {
            const bindings = parsePythonBehaveBindingsFromText(text, uri);
            if (bindings.length === 0) {
                return null;
            }
            return { providerId: 'python-behave', bindings };
        }
        if (lower.endsWith('.go')) {
            const bindings = parseGoGodogBindingsFromText(text, uri);
            if (bindings.length === 0) {
                return null;
            }
            return { providerId: 'go-godog', bindings };
        }
        if (lower.endsWith('.java')) {
            const bindings = parseJavaCucumberBindingsFromText(text, uri);
            if (bindings.length === 0) {
                return null;
            }
            return { providerId: 'java-cucumber', bindings };
        }
    } catch {
        return null;
    }
    return null;
}

function readText(absPath: string): string | null {
    try {
        return fs.readFileSync(absPath, 'utf8');
    } catch {
        return null;
    }
}

/**
 * Load features + bindings from a project directory (fail-soft on unreadable files).
 */
export function loadProject(projectDir: string): LoadedProject {
    const root = path.resolve(projectDir);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        throw new Error(`project directory not found: ${projectDir}`);
    }

    const files = walkProjectFiles(root);
    const features: FeatureDocument[] = [];
    const featurePaths: string[] = [];
    const loaded: LoadedBinding[] = [];
    const bindingPaths: string[] = [];
    const providers = new Set<BindingProviderId>();

    for (const abs of files) {
        if (isFeaturePath(abs)) {
            const text = readText(abs);
            if (text === null) {
                continue;
            }
            try {
                const doc = makeTextDocument(abs, text) as never;
                const parsed = parseFeatureDocument(doc);
                if (parsed) {
                    features.push(parsed);
                    featurePaths.push(abs);
                }
            } catch {
                // fail-soft
            }
            continue;
        }

        if (!isLikelyBindingPath(abs)) {
            continue;
        }
        const text = readText(abs);
        if (text === null) {
            continue;
        }
        const parsed = parseBindingsForFile(abs, text);
        if (!parsed || parsed.bindings.length === 0) {
            continue;
        }
        providers.add(parsed.providerId);
        bindingPaths.push(abs);
        for (const binding of parsed.bindings) {
            loaded.push({ binding, providerId: parsed.providerId });
        }
    }

    return {
        projectDir: root,
        features,
        bindings: loaded,
        providersDetected: [...providers].sort(),
        featurePaths,
        bindingPaths,
    };
}
