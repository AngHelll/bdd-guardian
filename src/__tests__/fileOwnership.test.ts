/**
 * File ownership candidates. These tests do not call the resolver.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { analyzeFileOwnership, loadProjectGraph } from '../core/ownership';
import type { FileOwnership, FileRelationKind } from '../core/ownership';

const ROOT = join(__dirname, 'fixtures/ownership/file-ownership');
const LAB = join(__dirname, 'fixtures/ownership/reqnroll-lab');

function slash(value: string): string {
    return value.replace(/\\/g, '/');
}

function kinds(file: FileOwnership, projectSuffix: string): FileRelationKind[] {
    return file.relations
        .filter((relation) => slash(relation.projectId).endsWith(projectSuffix))
        .map((relation) => relation.kind)
        .sort();
}

function fileEnding(files: readonly FileOwnership[], suffix: string): FileOwnership {
    const found = files.filter((file) => slash(file.identity.path).endsWith(suffix));
    expect(found).toHaveLength(1);
    return found[0];
}

describe('file ownership', () => {
    const graph = loadProjectGraph(ROOT);
    const report = analyzeFileOwnership(graph, [
        join(ROOT, 'explicit/Inside.cs'),
        join(ROOT, 'explicit/Inside.cs'),
        join(ROOT, 'remove/Skipped.cs'),
        join(ROOT, 'linked/outside/External.cs'),
        join(ROOT, 'multi/shared/Shared.cs'),
        join(ROOT, 'nested/inner/Nested.cs'),
        join(ROOT, 'no-manifest/Lonely.cs'),
        join(ROOT, 'no-manifest/Lonely.feature'),
        join(ROOT, 'glob/Kept.cs'),
        join(ROOT, 'condition/Maybe.cs'),
        join(ROOT, 'unknown-import/Inside.cs'),
        join(ROOT, 'feature-only/Features/listed.feature'),
        join(ROOT, 'feature-only/Features/unlisted.feature'),
        join(ROOT, 'default-off/Present.cs'),
        join(ROOT, 'legacy/Legacy.cs'),
        join(ROOT, 'broken/Orphan.cs'),
    ]);

    it('keeps one identity when the same path is requested twice', () => {
        expect(report.files.filter((file) => file.identity.fileName === 'Inside.cs')).toHaveLength(2);
        expect(report.files.filter((file) => slash(file.identity.path).endsWith('explicit/Inside.cs'))).toHaveLength(1);
    });

    it('records an explicit compile include without treating it as the only possible project shape', () => {
        const file = fileEnding(report.files, 'explicit/Inside.cs');
        expect(kinds(file, 'explicit/App.csproj')).toEqual([
            'directory-containment',
            'explicit-compile-include',
        ]);
        const declared = file.relations.find((relation) => relation.kind === 'explicit-compile-include');
        expect(declared).toMatchObject({
            status: 'resolved',
            confidence: 'declared',
            evidence: 'Compile Include="Inside.cs"',
        });
        expect(slash(declared?.originPath ?? '')).toMatch(/\/explicit\/App\.csproj$/);
        expect(file.evidenceGap).toBeNull();
    });

    it('records a literal remove and does not also mark the file as a default compile candidate', () => {
        const file = fileEnding(report.files, 'remove/Skipped.cs');
        expect(kinds(file, 'remove/App.csproj')).toEqual([
            'directory-containment',
            'explicit-compile-remove',
        ]);
        expect(file.relations.some((relation) => relation.kind === 'default-compile-candidate')).toBe(false);
    });

    it('records a linked file outside the project directory', () => {
        const file = fileEnding(report.files, 'linked/outside/External.cs');
        expect(file.relations.map((relation) => relation.kind)).toEqual(['linked-compile-include']);
        expect(file.relations[0]).toMatchObject({
            status: 'resolved',
            confidence: 'declared',
            evidence: 'Compile Include="..\\outside\\External.cs"',
        });
    });

    it('keeps one file identity when two projects include it', () => {
        const file = fileEnding(report.files, 'multi/shared/Shared.cs');
        expect(kinds(file, 'multi/a/A.csproj')).toEqual(['linked-compile-include']);
        expect(kinds(file, 'multi/b/B.csproj')).toEqual(['linked-compile-include']);
        expect(file.relations).toHaveLength(2);
    });

    it('keeps both the outer and the inner project for a nested file', () => {
        const file = fileEnding(report.files, 'nested/inner/Nested.cs');
        expect(kinds(file, 'nested/Outer.csproj')).toEqual([
            'default-compile-candidate',
            'directory-containment',
        ]);
        expect(kinds(file, 'nested/inner/Inner.csproj')).toEqual([
            'default-compile-candidate',
            'directory-containment',
        ]);
        const candidate = file.relations.find((relation) => relation.kind === 'default-compile-candidate');
        expect(candidate).toMatchObject({ status: 'inferred', confidence: 'convention' });
        expect(candidate?.detail).toContain('not a runtime fact');
    });

    it('does not invent an owner when no project manifest exists', () => {
        for (const suffix of ['no-manifest/Lonely.cs', 'no-manifest/Lonely.feature']) {
            const file = fileEnding(report.files, suffix);
            expect(file.relations).toEqual([]);
            expect(file.evidenceGap).toContain('does not prove');
        }
    });

    it('leaves globs, conditions, and unknown imports unresolved', () => {
        const glob = fileEnding(report.files, 'glob/Kept.cs');
        expect(kinds(glob, 'glob/App.csproj')).toEqual(['directory-containment', 'unknown']);
        expect(glob.relations.find((relation) => relation.kind === 'unknown')?.evidence).toContain('**');
        expect(glob.relations.some((relation) => relation.kind === 'default-compile-candidate')).toBe(false);

        const conditional = fileEnding(report.files, 'condition/Maybe.cs');
        expect(kinds(conditional, 'condition/App.csproj')).toEqual(['directory-containment', 'unknown']);
        expect(conditional.relations.find((relation) => relation.kind === 'unknown')?.detail).toContain('condition');
        expect(conditional.relations.some((relation) => relation.kind === 'explicit-compile-include')).toBe(false);

        const imported = fileEnding(report.files, 'unknown-import/Inside.cs');
        expect(kinds(imported, 'unknown-import/App.csproj')).toEqual(['directory-containment', 'unknown']);
        expect(imported.relations.find((relation) => relation.kind === 'unknown')?.evidence).toContain('Missing.targets');
        expect(imported.relations.some((relation) => relation.kind === 'default-compile-candidate')).toBe(false);
    });

    it('does not treat a feature under a folder as a confirmed project member', () => {
        const listed = fileEnding(report.files, 'feature-only/Features/listed.feature');
        expect(kinds(listed, 'feature-only/App.csproj')).toEqual([
            'directory-containment',
            'explicit-feature-include',
            'feature-candidate',
        ]);
        expect(listed.relations.find((relation) => relation.kind === 'explicit-feature-include')).toMatchObject({
            status: 'resolved',
            confidence: 'declared',
        });
        expect(listed.relations.some((relation) => relation.kind === 'default-compile-candidate')).toBe(false);

        const unlisted = fileEnding(report.files, 'feature-only/Features/unlisted.feature');
        expect(kinds(unlisted, 'feature-only/App.csproj')).toEqual([
            'directory-containment',
            'feature-candidate',
        ]);
        const candidate = unlisted.relations.find((relation) => relation.kind === 'feature-candidate');
        expect(candidate).toMatchObject({ status: 'inferred', confidence: 'physical' });
        expect(candidate?.detail).toContain('not a runtime fact');
    });

    it('separates physical containment from the SDK default', () => {
        const disabled = fileEnding(report.files, 'default-off/Present.cs');
        expect(kinds(disabled, 'default-off/App.csproj')).toEqual(['directory-containment']);

        const legacy = fileEnding(report.files, 'legacy/Legacy.cs');
        expect(kinds(legacy, 'legacy/App.csproj')).toEqual(['directory-containment']);
        expect(legacy.relations[0].confidence).toBe('physical');
        expect(legacy.relations[0].detail).toContain('does not establish compile inclusion');
    });

    it('keeps a broken project as unknown instead of choosing a nearest owner', () => {
        const file = fileEnding(report.files, 'broken/Orphan.cs');
        expect(kinds(file, 'broken/Broken.csproj')).toEqual(['directory-containment', 'unknown']);
        expect(file.relations.find((relation) => relation.kind === 'unknown')?.confidence).toBe('none');
    });

    it('describes E6 files without changing project references or binding load', () => {
        const lab = loadProjectGraph(LAB);
        const alpha = lab.projects.find((project) => project.identity.projectFileName === 'TestAlpha.csproj');
        expect(alpha).toBeTruthy();
        const references = alpha?.projectReferences;
        const bindingLoads = alpha?.reqnroll.bindingAssemblies;
        const owned = analyzeFileOwnership(lab, [
            join(LAB, 'BindingLib/SharedSteps.cs'),
            join(LAB, 'TestAlpha/Steps.cs'),
            join(LAB, 'TestBeta/Steps.cs'),
            join(LAB, 'TestAlpha/Features/ping.feature'),
            join(LAB, 'TestBeta/Features/ping.feature'),
        ]);
        expect(alpha?.projectReferences).toBe(references);
        expect(alpha?.reqnroll.bindingAssemblies).toBe(bindingLoads);
        expect(references?.map((item) => item.kind)).toEqual(['compile-reference']);
        expect(bindingLoads?.map((item) => item.kind)).toEqual(['binding-load']);

        const shared = fileEnding(owned.files, 'BindingLib/SharedSteps.cs');
        expect(kinds(shared, 'BindingLib/BindingLib.csproj')).toEqual([
            'default-compile-candidate',
            'directory-containment',
        ]);
        expect(shared.relations.some((relation) => slash(relation.projectId).includes('TestAlpha'))).toBe(false);
        expect(shared.relations.some((relation) => slash(relation.projectId).includes('TestBeta'))).toBe(false);

        const alphaSteps = fileEnding(owned.files, 'TestAlpha/Steps.cs');
        expect(kinds(alphaSteps, 'TestAlpha/TestAlpha.csproj')).toEqual([
            'default-compile-candidate',
            'directory-containment',
        ]);
        expect(alphaSteps.relations).toHaveLength(2);

        const alphaFeature = fileEnding(owned.files, 'TestAlpha/Features/ping.feature');
        expect(kinds(alphaFeature, 'TestAlpha/TestAlpha.csproj')).toEqual([
            'directory-containment',
            'feature-candidate',
        ]);
        expect(alphaFeature.relations.some((relation) => slash(relation.projectId).includes('TestBeta'))).toBe(false);
        expect(alphaFeature.relations.some((relation) => relation.kind === 'default-compile-candidate')).toBe(false);

        const betaFeature = fileEnding(owned.files, 'TestBeta/Features/ping.feature');
        expect(kinds(betaFeature, 'TestBeta/TestBeta.csproj')).toEqual([
            'directory-containment',
            'feature-candidate',
        ]);
        expect(betaFeature.identity.path).not.toBe(alphaFeature.identity.path);
    });
});
