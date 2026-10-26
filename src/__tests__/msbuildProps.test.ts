/**
 * Conservative Directory.Build.props resolution.
 * These tests do not call the resolver.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { loadProjectGraph } from '../core/ownership';
import type { DotnetProject, ProjectGraph } from '../core/ownership';

const ROOT = join(__dirname, 'fixtures/ownership/msbuild-props');

function slash(value: string): string {
    return value.replace(/\\/g, '/');
}

function projectEnding(graph: ProjectGraph, suffix: string): DotnetProject {
    const found = graph.projects.filter((project) => slash(project.identity.manifestPath).endsWith(suffix));
    expect(found).toHaveLength(1);
    return found[0];
}

describe('conservative MSBuild properties', () => {
    const graph = loadProjectGraph(ROOT);

    it('inherits unconditional literals and does not use the directory name as AssemblyName', () => {
        const app = projectEnding(graph, 'literal/src/App.csproj');
        expect(app.identity.directoryName).toBe('src');
        expect(app.identity.projectFileName).toBe('App.csproj');
        expect(app.assembly.name).toMatchObject({
            status: 'resolved',
            resolution: 'inherited',
            value: 'Literal.Assembly',
            source: 'directory-build-props',
            propertyName: 'AssemblyName',
        });
        expect(slash(app.assembly.name.originPath ?? '')).toMatch(/\/literal\/Directory\.Build\.props$/);
        expect(app.targetFrameworks).toMatchObject({
            status: 'resolved',
            resolution: 'inherited',
            value: ['net8.0'],
            propertyName: 'TargetFramework',
        });
        expect(app.hostAssembly?.kind).toBe('host-assembly');
        expect(app.hostAssembly?.assembly.name.value).toBe('Literal.Assembly');
        expect(app.projectReferences).toEqual([]);
        expect(app.reqnroll.status).toBe('absent');
    });

    it('lets an unconditional csproj property replace the props value', () => {
        const app = projectEnding(graph, '/override/App.csproj');
        expect(app.assembly.name).toMatchObject({
            status: 'resolved',
            resolution: 'explicit',
            value: 'FromProject',
            source: 'csproj-property',
            raw: 'FromProject',
        });
        expect(app.assembly.name.originPath).toBe(app.identity.manifestPath);
        expect(app.targetFrameworks).toMatchObject({
            status: 'resolved',
            resolution: 'explicit',
            value: ['net10.0'],
            source: 'csproj-property',
        });
    });

    it('leaves a conditioned props property unknown and keeps the unconditional sibling', () => {
        const app = projectEnding(graph, 'conditional-props/App.csproj');
        expect(app.assembly.name).toMatchObject({
            status: 'unknown',
            resolution: 'unknown',
            value: null,
            raw: 'Maybe.Name',
        });
        expect(app.assembly.name.value).not.toBe('App');
        expect(app.targetFrameworks).toMatchObject({
            status: 'resolved',
            resolution: 'inherited',
            value: ['net8.0'],
        });
    });

    it('expands a literal property reference and records where the assignment was written', () => {
        const open = projectEnding(graph, 'indirect/Open.csproj');
        expect(open.targetFrameworks).toMatchObject({
            status: 'resolved',
            resolution: 'inherited',
            value: ['net8.0'],
            raw: '$(SharedFramework)',
            source: 'directory-build-props',
        });
        expect(open.targetFrameworks.detail).toContain('SharedFramework');

        const ref = projectEnding(graph, 'indirect/Ref.csproj');
        expect(ref.targetFrameworks).toMatchObject({
            status: 'resolved',
            resolution: 'explicit',
            value: ['net8.0'],
            raw: '$(SharedFramework)',
            source: 'csproj-property',
        });
        expect(ref.targetFrameworks.originPath).toBe(ref.identity.manifestPath);
    });

    it('does not follow an Import, even when the imported file declares a literal', () => {
        const app = projectEnding(graph, 'unresolved-import/App.csproj');
        expect(app.targetFrameworks.status).toBe('unknown');
        expect(app.targetFrameworks.value).toBeNull();
        expect(app.targetFrameworks.raw).toBe('net8.0');
        expect(app.targetFrameworks.detail).toContain('Extra.props');
        expect(app.assembly.name).toMatchObject({ status: 'unknown', resolution: 'unknown', value: null });
        expect(JSON.stringify(app)).not.toContain('FromExtra');
        expect(JSON.stringify(app)).not.toContain('net10.0');
        expect(app.unevaluatedImports.some((item) => item.detail.includes('Extra.props'))).toBe(true);
    });

    it('keeps a literal written after an unresolved Import and does not invent AssemblyName', () => {
        const app = projectEnding(graph, 'import-then-literal/App.csproj');
        expect(app.targetFrameworks).toMatchObject({
            status: 'resolved',
            resolution: 'inherited',
            value: ['net8.0'],
        });
        expect(app.assembly.name).toMatchObject({ status: 'unknown', value: null });
        expect(app.assembly.name.detail).toContain('file-name default was not applied');
    });

    it('drops definitive values when a Directory.Build.targets file is present', () => {
        const app = projectEnding(graph, 'targets-override/App.csproj');
        expect(app.targetFrameworks).toMatchObject({ status: 'unknown', value: null, raw: 'net8.0' });
        expect(app.assembly.name).toMatchObject({ status: 'unknown', value: null, raw: 'FromProps' });
        expect(app.targetFrameworks.detail).toContain('Directory.Build.targets');
        expect(app.evaluatedImports.some((item) => item.path.endsWith('Directory.Build.props'))).toBe(true);
        expect(app.unevaluatedImports.some((item) => item.path.endsWith('Directory.Build.targets'))).toBe(true);
    });

    it('uses the nearest props for a nested project and the ancestor props otherwise', () => {
        const far = projectEnding(graph, 'nested/Far.csproj');
        expect(far.assembly.name).toMatchObject({
            status: 'resolved',
            resolution: 'inherited',
            value: 'Ancestor.Name',
        });
        expect(far.assembly.name.value).not.toBe('Far');
        expect(far.targetFrameworks.value).toEqual(['net8.0']);
        expect(slash(far.targetFrameworks.originPath ?? '')).toMatch(/\/nested\/Directory\.Build\.props$/);

        const near = projectEnding(graph, 'nested/child/Near.csproj');
        expect(near.identity.directoryName).toBe('child');
        expect(near.targetFrameworks).toMatchObject({
            resolution: 'inherited',
            value: ['net9.0'],
        });
        expect(slash(near.targetFrameworks.originPath ?? '')).toMatch(/\/nested\/child\/Directory\.Build\.props$/);
        expect(near.assembly.name).toMatchObject({
            status: 'inferred',
            resolution: 'derived',
            value: 'Near',
            source: 'project-file-name',
        });
        expect(near.assembly.name.value).not.toBe('Ancestor.Name');
        expect(near.assembly.name.value).not.toBe('child');
    });

    it('leaves environment properties, functions, and Choose unknown', () => {
        const environment = projectEnding(graph, 'environment/App.csproj');
        expect(environment.targetFrameworks).toMatchObject({
            status: 'unresolved',
            resolution: 'unresolved',
            value: null,
            raw: '$(Configuration)',
        });
        expect(environment.assembly.name).toMatchObject({
            status: 'inferred',
            resolution: 'derived',
            value: 'App',
        });

        const fn = projectEnding(graph, 'function/App.csproj');
        expect(fn.assembly.name).toMatchObject({
            status: 'unresolved',
            resolution: 'unresolved',
            value: null,
            raw: "$([System.String]::Copy('Computed'))",
        });
        expect(fn.assembly.name.value).not.toBe('Computed');

        const choose = projectEnding(graph, 'choose/App.csproj');
        expect(choose.targetFrameworks.status).toBe('unknown');
        expect(choose.targetFrameworks.value).toBeNull();
        expect(choose.targetFrameworks.detail).toContain('Choose/When');
    });
});
