/**
 * Tests for orphan / unused binding detection
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createResolver, ResolverDependencies } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { listOrphanBindings } from '../core/references';
import { Binding, FeatureStep, ResolvedKeyword } from '../core/domain/types';
import { Uri, Range } from './mocks/vscode';

function createBinding(
    keyword: ResolvedKeyword,
    pattern: string,
    methodName: string,
    lineNumber: number
): Binding {
    return {
        keyword,
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'TestSteps',
        methodName,
        uri: Uri.file('/test/Steps.cs') as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        signature: `TestSteps.${methodName}`,
    };
}

function createStep(
    keyword: ResolvedKeyword,
    text: string,
    lineNumber: number
): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword,
        rawText: text,
        normalizedText: text.replace(/\s+/g, ' ').trim(),
        fullText: `${keyword} ${text}`,
        tagsEffective: [],
        uri: Uri.file('/test/a.feature') as any,
        range: new Range(lineNumber, 0, lineNumber, 80) as any,
        lineNumber,
        isOutline: false,
        candidateTexts: [text],
    };
}

describe('listOrphanBindings', () => {
    let bindingUsed: Binding;
    let bindingOrphan: Binding;
    let resolve: ReturnType<typeof createResolver>;

    beforeEach(() => {
        bindingUsed = createBinding('Given', 'user is logged in', 'UserIsLoggedIn', 10);
        bindingOrphan = createBinding('Given', 'orphaned unused step', 'OrphanMethod', 20);
        const bindings = [bindingUsed, bindingOrphan];
        const deps: ResolverDependencies = {
            getAllBindings: () => bindings,
            getBindingsByKeyword: (kw) => bindings.filter((b) => b.keyword === kw),
        };
        resolve = createResolver(deps);
    });

    it('returns bindings with zero feature usages', () => {
        const steps = [createStep('Given', 'user is logged in', 5)];
        const orphans = listOrphanBindings(
            [bindingUsed, bindingOrphan],
            steps,
            resolve
        );
        expect(orphans).toHaveLength(1);
        expect(orphans[0].methodName).toBe('OrphanMethod');
    });

    it('returns empty when every binding is used', () => {
        const steps = [
            createStep('Given', 'user is logged in', 5),
            createStep('Given', 'orphaned unused step', 6),
        ];
        const orphans = listOrphanBindings(
            [bindingUsed, bindingOrphan],
            steps,
            resolve
        );
        expect(orphans).toHaveLength(0);
    });

    it('marks all bindings orphan when there are no steps', () => {
        const orphans = listOrphanBindings([bindingUsed, bindingOrphan], [], resolve);
        expect(orphans).toHaveLength(2);
    });
});
