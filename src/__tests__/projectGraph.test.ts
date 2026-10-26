/**
 * Static project graph. These tests do not call the resolver.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
    absentReqnrollConfig,
    bindingAssembliesOf,
    incompleteRelations,
    listProjects,
    loadProjectGraph,
    parseProjectFile,
    projectReferencesOf,
    readReqnrollConfig,
} from '../core/ownership';
import type { DotnetProject, ProjectGraph } from '../core/ownership';

const LAB = join(__dirname, 'fixtures/ownership/reqnroll-lab');
const GRAPH = join(__dirname, 'fixtures/ownership/project-graph');

function slash(value: string): string {
    return value.replace(/\\/g, '/');
}

function projectEnding(graph: ProjectGraph, suffix: string): DotnetProject {
    const found = listProjects(graph).filter((project) => slash(project.identity.manifestPath).endsWith(suffix));
    expect(found).toHaveLength(1);
    return found[0];
}

function keysOf(value: unknown, keys: Set<string> = new Set()): Set<string> {
    if (Array.isArray(value)) {
        for (const item of value) {
            keysOf(item, keys);
        }
        return keys;
    }
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            keys.add(key);
            keysOf(child, keys);
        }
    }
    return keys;
}

describe('project graph', () => {
    const lab = loadProjectGraph(LAB);
    const cases = loadProjectGraph(GRAPH);

    it('reads every project under a root, including nested projects, and skips a missing root', () => {
        expect(listProjects(lab).map((project) => project.identity.projectFileName).sort()).toEqual([
            'BindingLib.csproj',
            'TestAlpha.csproj',
            'TestBeta.csproj',
        ]);
        expect(listProjects(cases)).toHaveLength(13);
        expect(loadProjectGraph(join(GRAPH, 'does-not-exist')).projects).toEqual([]);
    });

    it('infers AssemblyName from the project file name and ignores the directory name', () => {
        const app = projectEnding(cases, 'file-name-not-folder/src/App.csproj');
        expect(app.identity.directoryName).toBe('src');
        expect(app.identity.projectFileName).toBe('App.csproj');
        expect(app.assembly.name).toMatchObject({
            status: 'inferred',
            value: 'App',
            source: 'project-file-name',
        });
        expect(app.hostAssembly?.kind).toBe('host-assembly');
        expect(app.hostAssembly?.assembly.name.value).toBe('App');
    });

    it('keeps an explicit AssemblyName', () => {
        const named = projectEnding(cases, 'explicit-name/src/Named.csproj');
        expect(named.identity.directoryName).toBe('src');
        expect(named.assembly.name).toMatchObject({
            status: 'resolved',
            value: 'Custom.Assembly',
            source: 'csproj-property',
        });
        expect(named.targetFrameworks).toMatchObject({
            status: 'resolved',
            value: ['net8.0'],
        });
    });

    it('resolves a ProjectReference that exists and records one that does not', () => {
        const outer = projectEnding(cases, 'nested/Outer.csproj');
        const inner = projectEnding(cases, 'nested/inner/Inner.csproj');
        const [reference] = projectReferencesOf(outer);
        expect(reference.kind).toBe('compile-reference');
        expect(reference.status).toBe('resolved');
        expect(reference.candidatePath).toBe(inner.identity.manifestPath);
        expect(reference.include).toBe('inner\\Inner.csproj');
        expect(projectReferencesOf(inner)).toEqual([]);

        const missing = projectEnding(cases, 'missing-ref/Missing.csproj');
        const [broken] = projectReferencesOf(missing);
        expect(broken.status).toBe('unresolved');
        expect(slash(broken.candidatePath ?? '')).toMatch(/\/nope\/Nope\.csproj$/);
        expect(broken.detail).toContain('does not point at an existing file');
    });

    it('keeps a compile reference when bindingAssemblies is absent', () => {
        const alphaPath = join(LAB, 'TestAlpha/TestAlpha.csproj');
        const alpha = parseProjectFile({
            text: readFileSync(alphaPath, 'utf8'),
            manifestPath: alphaPath,
            reqnroll: absentReqnrollConfig(null),
            scanRoot: LAB,
        });
        expect(projectReferencesOf(alpha)).toHaveLength(1);
        expect(projectReferencesOf(alpha)[0].status).toBe('resolved');
        expect(slash(projectReferencesOf(alpha)[0].candidatePath ?? '')).toMatch(/\/BindingLib\/BindingLib\.csproj$/);
        expect(alpha.reqnroll.status).toBe('absent');
        expect(bindingAssembliesOf(alpha)).toEqual([]);
    });

    it('reads bindingAssemblies from the lab without turning the ProjectReference into a load entry', () => {
        const alpha = projectEnding(lab, 'TestAlpha/TestAlpha.csproj');
        const beta = projectEnding(lab, 'TestBeta/TestBeta.csproj');
        const lib = projectEnding(lab, 'BindingLib/BindingLib.csproj');

        expect(alpha.reqnroll.status).toBe('present');
        expect(bindingAssembliesOf(alpha).map((item) => item.assemblyName.value)).toEqual(['BindingLib']);
        expect(bindingAssembliesOf(alpha)[0]).toMatchObject({
            kind: 'binding-load',
            source: 'reqnroll-json',
        });
        expect(slash(bindingAssembliesOf(alpha)[0].configPath)).toMatch(/\/TestAlpha\/reqnroll\.json$/);
        expect(projectReferencesOf(alpha).map((item) => item.kind)).toEqual(['compile-reference']);
        expect(projectReferencesOf(alpha).some((item) => slash(item.candidatePath ?? '').includes('TestBeta'))).toBe(false);
        expect(projectReferencesOf(beta).some((item) => slash(item.candidatePath ?? '').includes('TestAlpha'))).toBe(false);

        expect(lib.reqnroll.status).toBe('absent');
        expect(slash(lib.reqnroll.configPath ?? '')).toMatch(/\/BindingLib\/reqnroll\.json$/);
        expect(bindingAssembliesOf(lib)).toEqual([]);
        expect(lib.hostAssembly?.kind).toBe('host-assembly');
        expect(keysOf(lab).has('accessible')).toBe(false);
    });

    it('reads the E6 Directory.Build.props literals and derives AssemblyName only from the file name', () => {
        for (const suffix of ['BindingLib/BindingLib.csproj', 'TestAlpha/TestAlpha.csproj', 'TestBeta/TestBeta.csproj']) {
            const project = projectEnding(lab, suffix);
            const fileStem = project.identity.projectFileName.replace(/\.csproj$/i, '');
            expect(project.assembly.name).toMatchObject({
                status: 'inferred',
                resolution: 'derived',
                value: fileStem,
                source: 'project-file-name',
                propertyName: 'AssemblyName',
            });
            expect(project.assembly.name.originPath).toBe(project.identity.manifestPath);
            expect(project.assembly.name.detail).toContain('not a runtime observation');
            expect(project.targetFrameworks).toMatchObject({
                status: 'resolved',
                resolution: 'inherited',
                value: ['net8.0'],
                raw: 'net8.0',
                source: 'directory-build-props',
                propertyName: 'TargetFramework',
            });
            expect(project.targetFrameworks.originPath).toMatch(/Directory\.Build\.props$/);
            expect(project.evaluatedImports.some((item) => item.path.endsWith('Directory.Build.props'))).toBe(true);
            expect(project.unevaluatedImports.some((item) => item.path.endsWith('Directory.Build.props'))).toBe(false);
            expect(project.hostAssembly?.kind).toBe('host-assembly');
            expect(project.projectReferences.every((item) => item.kind === 'compile-reference')).toBe(true);
        }
        const gaps = incompleteRelations(lab);
        expect(gaps.filter((gap) => gap.kind === 'assembly-name')).toHaveLength(0);
        expect(gaps.filter((gap) => gap.kind === 'target-framework')).toHaveLength(0);
        expect(gaps.filter((gap) => gap.kind === 'project-reference')).toHaveLength(0);
        expect(gaps.filter((gap) => gap.kind === 'reqnroll-config')).toHaveLength(0);
    });

    it('distinguishes an absent config from invalid JSON and from a partial entry', () => {
        const plain = projectEnding(cases, 'no-config/Plain.csproj');
        expect(plain.reqnroll.status).toBe('absent');
        expect(plain.reqnroll.formatError).toBeNull();
        expect(slash(plain.reqnroll.configPath ?? '')).toMatch(/\/no-config\/reqnroll\.json$/);

        const bad = projectEnding(cases, 'invalid-json/Bad.csproj');
        expect(bad.reqnroll.status).toBe('invalid');
        expect(bad.reqnroll.formatError).toBeTruthy();
        expect(bindingAssembliesOf(bad)).toEqual([]);

        const partial = projectEnding(cases, 'partial-json/Partial.csproj');
        expect(partial.reqnroll.status).toBe('present');
        expect(bindingAssembliesOf(partial).map((item) => item.assemblyName.status)).toEqual(['unknown', 'resolved']);
        expect(bindingAssembliesOf(partial)[1].assemblyName.value).toBe('Loaded.Lib');

        const present = readReqnrollConfig({
            text: '{ "language": { "feature": "en" } }',
            configPath: 'reqnroll.json',
        });
        expect(present).toMatchObject({ status: 'present', bindingAssemblies: [], formatError: null });
        const notArray = readReqnrollConfig({
            text: '{ "bindingAssemblies": "BindingLib" }',
            configPath: 'reqnroll.json',
        });
        expect(notArray.status).toBe('invalid');
    });

    it('does not evaluate MSBuild properties, conditions, or Directory.Build.targets', () => {
        const dynamic = projectEnding(cases, 'dynamic/Dynamic.csproj');
        expect(dynamic.assembly.name).toMatchObject({ status: 'unresolved', raw: '$(CustomAssembly)', value: null });
        expect(dynamic.targetFrameworks).toMatchObject({ status: 'unresolved', raw: '$(ConfiguredFramework)', value: null });
        expect(projectReferencesOf(dynamic)[0]).toMatchObject({
            status: 'unresolved',
            include: '$(LibPath)',
            candidatePath: null,
        });

        const conditioned = projectEnding(cases, 'conditioned/Conditioned.csproj');
        expect(conditioned.assembly.name.status).toBe('unknown');
        expect(conditioned.assembly.name.raw).toBe('DebugOnly');
        expect(conditioned.targetFrameworks.value).toEqual(['net8.0']);
        const [conditionalRef] = projectReferencesOf(conditioned);
        expect(conditionalRef.status).toBe('unknown');
        expect(slash(conditionalRef.candidatePath ?? '')).toMatch(/\/App\.csproj$/);

        const both = projectEnding(cases, 'both-tfms/Both.csproj');
        expect(both.targetFrameworks.status).toBe('unknown');
        expect(both.targetFrameworks.value).toBeNull();
        expect(both.targetFrameworks.raw).toContain('net8.0');
        expect(both.targetFrameworks.raw).toContain('net8.0;net10.0');

        const late = projectEnding(cases, 'late-import/Late.csproj');
        expect(late.assembly.name).toMatchObject({ status: 'unknown', value: null, raw: 'Explicit.Late' });
        expect(late.targetFrameworks).toMatchObject({ status: 'unknown', value: null, raw: 'net8.0' });
        expect(late.unevaluatedImports.some((item) => item.path.endsWith('Directory.Build.targets'))).toBe(true);

        const broken = projectEnding(cases, 'broken/Broken.csproj');
        expect(broken.parseError).toBeTruthy();
        expect(broken.hostAssembly).toBeNull();
        expect(incompleteRelations(cases).some((gap) => gap.kind === 'csproj-parse' && gap.projectId === broken.identity.id)).toBe(true);
    });

    it('decodes an assembly name entity and keeps the later unconditional declaration', () => {
        const encoded = parseProjectFile({
            text: '<Project><PropertyGroup><AssemblyName>A&amp;B</AssemblyName></PropertyGroup></Project>',
            manifestPath: join(GRAPH, 'encoded/Encoded.csproj'),
            reqnroll: absentReqnrollConfig(null),
        });
        expect(encoded.assembly.name.value).toBe('A&B');

        const twice = parseProjectFile({
            text: '<Project><PropertyGroup><AssemblyName>One</AssemblyName><AssemblyName>Two</AssemblyName></PropertyGroup></Project>',
            manifestPath: join(GRAPH, 'twice/Twice.csproj'),
            reqnroll: absentReqnrollConfig(null),
        });
        expect(twice.assembly.name).toMatchObject({
            status: 'resolved',
            resolution: 'explicit',
            value: 'Two',
            raw: 'Two',
        });
    });

    it('stays out of the resolver, the map, and the VS Code API', () => {
        const dir = join(__dirname, '../core/ownership');
        const sources = readdirSync(dir).filter((name) => name.endsWith('.ts'));
        expect(sources.length).toBeGreaterThan(0);
        for (const name of sources) {
            const text = readFileSync(join(dir, name), 'utf8');
            expect(text).not.toContain('createResolver');
            expect(text).not.toContain('summarizeSuiteMap');
            expect(text).not.toContain('preferSpecificBinding');
            expect(text).not.toContain("from 'vscode'");
            expect(text).not.toContain('from "vscode"');
        }
    });
});
