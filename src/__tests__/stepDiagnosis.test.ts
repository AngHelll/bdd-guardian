/**
 * Evidence explanations beside the current resolver.
 * These tests assert the resolver status is left unchanged.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createResolver } from '../core/matching/resolver';
import { compileBindingRegex } from '../core/parsing/bindingRegex';
import { parseFeatureDocument } from '../core/parsing/gherkinParser';
import { parseCSharpBindingsFromText } from '../core/parsing/csharpBindingParser';
import { parseGoGodogBindingsFromText } from '../core/parsing/goGodogBindingParser';
import { parseJsCucumberBindingsFromText } from '../core/parsing/jsCucumberBindingParser';
import type { Binding, FeatureStep, ResolveResult } from '../core/domain/types';
import {
    absentReqnrollConfig,
    analyzeFileOwnership,
    explainStep,
    loadProjectGraph,
} from '../core/ownership';
import type { ExplanationKind, StepDiagnosis } from '../core/ownership';
import { createMockDocument, Range, Uri } from './mocks/vscode';

const ROOT = join(__dirname, 'fixtures/ownership');
const LAB = join(ROOT, 'reqnroll-lab');

function slash(value: string): string {
    return value.replace(/\\/g, '/');
}

function featureSteps(abs: string): FeatureStep[] {
    const parsed = parseFeatureDocument(createMockDocument(readFileSync(abs, 'utf8'), abs) as never);
    if (!parsed) {
        throw new Error(abs);
    }
    return [...parsed.allSteps];
}

function csharp(abs: string): Binding[] {
    return parseCSharpBindingsFromText(readFileSync(abs, 'utf8'), Uri.file(abs) as never);
}

function resolve(steps: readonly FeatureStep[], bindings: readonly Binding[], step: FeatureStep): ResolveResult {
    const resolver = createResolver({
        getAllBindings: () => bindings,
        getBindingsByKeyword: (keyword) => bindings.filter((binding) => binding.keyword === keyword),
        preferSpecificBinding: false,
    });
    return resolver(step);
}

function kinds(diagnosis: StepDiagnosis): ExplanationKind[] {
    return diagnosis.explanations.map((item) => item.kind);
}

function syntheticBinding(abs: string, pattern: string, method: string, scopeTags: readonly string[] = []): Binding {
    return {
        keyword: 'Given',
        patternRaw: pattern,
        regex: compileBindingRegex(pattern)!,
        className: 'Synthetic',
        methodName: method,
        uri: Uri.file(abs) as never,
        range: new Range(0, 0, 0, 1) as never,
        lineNumber: 0,
        signature: `Synthetic.${method}`,
        scopeTags,
    };
}

function syntheticStep(abs: string, text: string, keyword: FeatureStep['keywordOriginal'] = 'Given'): FeatureStep {
    return {
        keywordOriginal: keyword,
        keywordResolved: keyword === 'When' || keyword === 'Then' ? keyword : 'Given',
        rawText: text,
        normalizedText: text,
        fullText: `${keyword} ${text}`,
        tagsEffective: [],
        uri: Uri.file(abs) as never,
        range: new Range(1, 0, 1, 1) as never,
        lineNumber: 1,
        isOutline: false,
        candidateTexts: [text],
    };
}

describe('step diagnosis', () => {
    const labGraph = loadProjectGraph(LAB);
    const labFiles = [
        join(LAB, 'BindingLib/SharedSteps.cs'),
        join(LAB, 'TestAlpha/Steps.cs'),
        join(LAB, 'TestBeta/Steps.cs'),
        join(LAB, 'TestAlpha/Features/overlap.feature'),
        join(LAB, 'TestAlpha/Features/ping.feature'),
        join(LAB, 'TestBeta/Features/ping.feature'),
        join(LAB, 'TestAlpha/Features/shared.feature'),
        join(LAB, 'TestAlpha/Features/keyword.feature'),
        join(LAB, 'TestAlpha/Features/scope.feature'),
        join(LAB, 'TestAlpha/Features/loose.feature'),
    ];
    const labOwnership = analyzeFileOwnership(labGraph, labFiles);

    it('explains same-project overlap without changing the ambiguous result', () => {
        const steps = featureSteps(join(LAB, 'TestAlpha/Features/overlap.feature'));
        const bindings = csharp(join(LAB, 'TestAlpha/Steps.cs')).filter((binding) => binding.patternRaw.includes('entered'));
        const step = steps[0];
        const result = resolve(steps, bindings, step);
        const diagnosis = explainStep({ result, graph: labGraph, ownership: labOwnership, poolBindings: bindings });
        expect(result.status).toBe('ambiguous');
        expect(diagnosis.resolverStatus).toBe('ambiguous');
        expect(diagnosis.resolverCandidateCount).toBe(2);
        expect(kinds(diagnosis)).toContain('same-project-overlap');
        expect(kinds(diagnosis)).not.toContain('cross-project-candidates');
        expect(diagnosis.runtimeConfirmed).toBe(false);
        expect(diagnosis.explanations.every((item) => item.runtimeConfirmed === false)).toBe(true);
        expect(diagnosis.explanations.every((item) => item.layers.runtimeAccessibility === false)).toBe(true);
        const overlap = diagnosis.explanations.find((item) => item.kind === 'same-project-overlap');
        expect(overlap?.confidence).toBe('convention');
        expect(overlap?.layers.potentialCompile).toBe(true);
        expect(overlap?.layers.textualMatch).toBe(true);
        expect(overlap?.projectIds.some((id) => slash(id).endsWith('TestAlpha/TestAlpha.csproj'))).toBe(true);
    });

    it('does not call two folders without manifests a cross-project fact', () => {
        const e1 = join(ROOT, 'e1-duplicate-pattern');
        const graph = loadProjectGraph(e1);
        const files = [
            join(e1, 'project-a/Features/ping.feature'),
            join(e1, 'project-b/Features/ping.feature'),
            join(e1, 'project-a/Steps/PingSteps.cs'),
            join(e1, 'project-b/Steps/PingSteps.cs'),
        ];
        const ownership = analyzeFileOwnership(graph, files);
        const bindings = [...csharp(files[2]), ...csharp(files[3])];
        const steps = [...featureSteps(files[0]), ...featureSteps(files[1])];
        const step = steps.find((item) => slash(item.uri.fsPath).includes('project-a'));
        const result = resolve(steps, bindings, step!);
        const diagnosis = explainStep({ result, graph, ownership, poolBindings: bindings });
        expect(result.status).toBe('ambiguous');
        expect(diagnosis.resolverStatus).toBe('ambiguous');
        expect(diagnosis.resolverCandidateCount).toBe(2);
        expect(kinds(diagnosis)).toContain('insufficient-ownership-evidence');
        expect(kinds(diagnosis)).toContain('unresolved-project-context');
        expect(kinds(diagnosis)).not.toContain('cross-project-candidates');
        expect(kinds(diagnosis)).not.toContain('same-project-overlap');
    });

    it('reports bindingAssemblies as declared configuration and not as runtime load', () => {
        const steps = featureSteps(join(LAB, 'TestAlpha/Features/shared.feature'));
        const bindings = csharp(join(LAB, 'BindingLib/SharedSteps.cs'));
        const result = resolve(steps, bindings, steps[0]);
        const before = labGraph.projects.find((project) => project.identity.projectFileName === 'TestAlpha.csproj')?.reqnroll;
        const diagnosis = explainStep({ result, graph: labGraph, ownership: labOwnership, poolBindings: bindings });
        expect(result.status).toBe('bound');
        expect(diagnosis.resolverStatus).toBe('bound');
        expect(before?.bindingAssemblies.map((entry) => entry.assemblyName.value)).toEqual(['BindingLib']);
        const load = diagnosis.explanations.find((item) => item.kind === 'binding-load-evidence');
        expect(load?.nameMatch).toBe('derived-file-name');
        expect(load?.confidence).toBe('declared');
        expect(load?.detail).toContain('not load proof');
        expect(load?.detail).toContain('ProjectReference');
        expect(load?.layers.loadConfiguration).toBe(true);
        expect(load?.layers.runtimeAccessibility).toBe(false);
        expect(load?.provenance.some((item) => item.includes('bindingAssemblies'))).toBe(true);
    });

    it('keeps a ProjectReference without bindingAssemblies from becoming load evidence', () => {
        const steps = featureSteps(join(LAB, 'TestAlpha/Features/shared.feature'));
        const bindings = csharp(join(LAB, 'BindingLib/SharedSteps.cs'));
        const result = resolve(steps, bindings, steps[0]);
        const stripped = {
            projects: labGraph.projects.map((project) => project.identity.projectFileName === 'TestAlpha.csproj'
                ? { ...project, reqnroll: absentReqnrollConfig(join(project.identity.directoryPath, 'reqnroll.json')) }
                : project),
        };
        const diagnosis = explainStep({ result, graph: stripped, ownership: labOwnership, poolBindings: bindings });
        const original = labGraph.projects.find((project) => project.identity.projectFileName === 'TestAlpha.csproj');
        expect(original?.reqnroll.bindingAssemblies).toHaveLength(1);
        expect(result.status).toBe('bound');
        expect(diagnosis.resolverStatus).toBe('bound');
        const load = diagnosis.explanations.find((item) => item.kind === 'binding-load-evidence');
        expect(load?.confidence).toBe('none');
        expect(load?.nameMatch).toBe('none');
        expect(load?.detail).toContain('ProjectReference');
        expect(load?.detail).toContain('not bindingAssemblies');
        expect(load?.runtimeConfirmed).toBe(false);
    });

    it('does not treat a present file without compile evidence as an executable binding', () => {
        const root = join(ROOT, 'file-ownership/default-off');
        const graph = loadProjectGraph(root);
        const bindingFile = join(root, 'Present.cs');
        const featureFile = join(root, 'present.feature');
        const ownership = analyzeFileOwnership(graph, [bindingFile, featureFile]);
        const bindings = [syntheticBinding(bindingFile, 'the file is only present', 'OnlyPresent')];
        const step = syntheticStep(featureFile, 'the file is only present');
        const result = resolve([step], bindings, step);
        const diagnosis = explainStep({ result, graph, ownership, poolBindings: bindings });
        expect(result.status).toBe('bound');
        expect(diagnosis.resolverStatus).toBe('bound');
        expect(kinds(diagnosis)).toContain('insufficient-ownership-evidence');
        expect(kinds(diagnosis)).not.toContain('same-project-overlap');
        const weak = diagnosis.explanations.find((item) => item.kind === 'insufficient-ownership-evidence');
        expect(weak?.detail).toContain('unchanged');
        expect(weak?.relations.some((relation) => relation.kind === 'default-compile-candidate')).toBe(false);
        expect(diagnosis.missing.some((item) => item.includes('not evidence'))).toBe(true);
    });

    it('lists every owning project and does not choose the nearest', () => {
        const root = join(ROOT, 'file-ownership/nested');
        const graph = loadProjectGraph(root);
        const bindingFile = join(root, 'inner/Nested.cs');
        const featureFile = join(root, 'inner/sample.feature');
        const ownership = analyzeFileOwnership(graph, [bindingFile, featureFile]);
        const bindings = [syntheticBinding(bindingFile, 'both projects contain this file', 'Nested')];
        const step = syntheticStep(featureFile, 'both projects contain this file');
        const result = resolve([step], bindings, step);
        const diagnosis = explainStep({ result, graph, ownership, poolBindings: bindings });
        expect(diagnosis.resolverStatus).toBe(result.status);
        const context = diagnosis.explanations.find((item) => item.kind === 'unresolved-project-context');
        expect(context?.projectIds).toHaveLength(2);
        expect(context?.detail).toContain('more than one project');
        expect(context?.missing.some((item) => item.includes('Nearness'))).toBe(true);
    });

    it('leaves an unknown feature without a project owner', () => {
        const e3 = join(ROOT, 'e3-no-bindings/lonely.feature');
        const graph = loadProjectGraph(join(ROOT, 'e3-no-bindings'));
        const ownership = analyzeFileOwnership(graph, [e3]);
        const steps = featureSteps(e3);
        const result = resolve(steps, [], steps[0]);
        const diagnosis = explainStep({ result, graph, ownership, poolBindings: [] });
        expect(result.status).toBe('unbound');
        expect(diagnosis.resolverStatus).toBe('unbound');
        expect(diagnosis.resolverCandidateCount).toBe(0);
        expect(kinds(diagnosis)).toContain('unresolved-project-context');
        expect(kinds(diagnosis)).not.toContain('cross-project-candidates');
    });

    it('does not treat another framework file as runtime-inaccessible', () => {
        const e5 = join(ROOT, 'e5-frameworks');
        const godogFeature = join(e5, 'godog/features/godogs.feature');
        const godogSteps = join(e5, 'godog/godogs_test.go');
        const jsSteps = join(e5, 'cucumber/steps.js');
        const graph = loadProjectGraph(e5);
        const ownership = analyzeFileOwnership(graph, [godogFeature, godogSteps, jsSteps]);
        const bindings = [
            ...parseGoGodogBindingsFromText(readFileSync(godogSteps, 'utf8'), Uri.file(godogSteps) as never),
            ...parseJsCucumberBindingsFromText(readFileSync(jsSteps, 'utf8'), Uri.file(jsSteps) as never),
        ];
        const steps = featureSteps(godogFeature);
        const result = resolve(steps, bindings, steps[0]);
        const diagnosis = explainStep({ result, graph, ownership, poolBindings: bindings });
        expect(result.status).toBe('bound');
        expect(diagnosis.resolverStatus).toBe('bound');
        expect(diagnosis.resolverCandidateCount).toBe(1);
        expect(kinds(diagnosis)).toContain('unresolved-project-context');
        expect(kinds(diagnosis)).not.toContain('cross-project-candidates');
        const context = diagnosis.explanations.find((item) => item.kind === 'unresolved-project-context');
        expect(context?.files.some((file) => slash(file).endsWith('steps.js'))).toBe(true);
        expect(context?.missing.some((item) => item.includes('not prove'))).toBe(true);
        expect(context?.detail).not.toContain('inaccessible');
    });

    it('notices scoped bindings the resolver did not select without promoting the step to bound', () => {
        const feature = join(LAB, 'TestAlpha/Features/scope.feature');
        const bindings = csharp(join(LAB, 'TestAlpha/Steps.cs')).filter((binding) => binding.patternRaw === 'I log in with scoped credentials');
        const steps = featureSteps(feature);
        const bare = steps.find((step) => !step.tagsEffective.includes('@web') && !step.tagsEffective.includes('@api'));
        const result = resolve(steps, bindings, bare!);
        const diagnosis = explainStep({ result, graph: labGraph, ownership: labOwnership, poolBindings: bindings });
        expect(result.status).toBe('unbound');
        expect(result.candidates).toHaveLength(0);
        expect(diagnosis.resolverStatus).toBe('unbound');
        expect(diagnosis.resolverCandidateCount).toBe(0);
        const scope = diagnosis.explanations.find((item) => item.kind === 'scope-not-selected');
        expect(scope?.confidence).toBe('none');
        expect(scope?.provenance).toHaveLength(2);
        expect(scope?.detail).toContain('does not reclassify');
        expect(scope?.layers.runtimeAccessibility).toBe(false);
    });

    it('does not explain a cross-keyword match after the resolver leaves the step unbound', () => {
        // Was bound with keywordMatched false, which produced keyword-fallback.
        const feature = join(LAB, 'TestAlpha/Features/keyword.feature');
        const bindings = csharp(join(LAB, 'TestAlpha/Steps.cs')).filter((binding) => binding.patternRaw === 'the pump is primed');
        const steps = featureSteps(feature);
        const result = resolve(steps, bindings, steps[0]);
        const diagnosis = explainStep({ result, graph: labGraph, ownership: labOwnership, poolBindings: bindings });
        expect(result.status).toBe('unbound');
        expect(result.candidates).toHaveLength(0);
        expect(diagnosis.resolverStatus).toBe('unbound');
        expect(diagnosis.resolverCandidateCount).toBe(0);
        expect(diagnosis.explanations.some((item) => item.kind === 'keyword-fallback')).toBe(false);
    });

    it('separates copied patterns in E6 from load configuration and keeps both candidates', () => {
        const alphaFeature = join(LAB, 'TestAlpha/Features/ping.feature');
        const bindings = [
            ...csharp(join(LAB, 'TestAlpha/Steps.cs')),
            ...csharp(join(LAB, 'TestBeta/Steps.cs')),
        ].filter((binding) => binding.patternRaw === 'I ping {int}');
        const steps = featureSteps(alphaFeature);
        const result = resolve(steps, bindings, steps[0]);
        const diagnosis = explainStep({ result, graph: labGraph, ownership: labOwnership, poolBindings: bindings });
        expect(result.status).toBe('ambiguous');
        expect(diagnosis.resolverStatus).toBe('ambiguous');
        expect(diagnosis.resolverCandidateCount).toBe(2);
        const cross = diagnosis.explanations.find((item) => item.kind === 'cross-project-candidates');
        expect(cross?.confidence).toBe('convention');
        expect(cross?.projectIds).toHaveLength(2);
        expect(cross?.detail).toContain('neither candidate was removed');
        expect(cross?.layers.runtimeAccessibility).toBe(false);
        const load = diagnosis.explanations.filter((item) => item.kind === 'binding-load-evidence');
        expect(load.some((item) => item.nameMatch === 'none')).toBe(true);
        expect(load.every((item) => item.detail.includes('not proof') || item.detail.includes('does not establish'))).toBe(true);
    });
});
