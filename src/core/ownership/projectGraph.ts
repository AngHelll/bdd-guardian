/**
 * Queryable graph of project files, compile references, and Reqnroll load lists.
 * Nothing here removes binding candidates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { absentReqnrollConfig, parseProjectFile } from './csprojReader';
import { readReqnrollConfig } from './reqnrollConfigReader';
import { stripBom } from './xmlLite';
import type {
    BindingAssemblyEvidence,
    DotnetProject,
    IncompleteRelation,
    ProjectGraph,
    ProjectReferenceEvidence,
} from './types';

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

export function loadProjectGraph(root: string): ProjectGraph {
    const scanRoot = path.resolve(root);
    if (!fs.existsSync(scanRoot)) {
        return { projects: [] };
    }
    const projects = findCsprojFiles(scanRoot).map((manifestPath) => {
        const text = fs.readFileSync(manifestPath, 'utf8');
        const configPath = path.join(path.dirname(manifestPath), 'reqnroll.json');
        const reqnroll = fs.existsSync(configPath)
            ? readReqnrollConfig({ text: stripBom(fs.readFileSync(configPath, 'utf8')), configPath })
            : absentReqnrollConfig(configPath);
        return parseProjectFile({ text, manifestPath, reqnroll, scanRoot });
    });
    return { projects };
}

export function listProjects(graph: ProjectGraph): readonly DotnetProject[] {
    return graph.projects;
}

export function projectReferencesOf(project: DotnetProject): readonly ProjectReferenceEvidence[] {
    return project.projectReferences;
}

export function bindingAssembliesOf(project: DotnetProject): readonly BindingAssemblyEvidence[] {
    return project.reqnroll.bindingAssemblies;
}

export function incompleteRelations(graph: ProjectGraph): readonly IncompleteRelation[] {
    const rows: IncompleteRelation[] = [];
    for (const project of graph.projects) {
        if (project.parseError) {
            rows.push({
                projectId: project.identity.id,
                kind: 'csproj-parse',
                status: 'invalid',
                detail: project.parseError,
            });
            continue;
        }
        const assembly = project.assembly.name;
        if (assembly.status === 'unknown' || assembly.status === 'unresolved') {
            rows.push({
                projectId: project.identity.id,
                kind: 'assembly-name',
                status: assembly.status,
                detail: assembly.detail ?? 'Assembly name is not known.',
            });
        }
        const frameworks = project.targetFrameworks;
        if (frameworks.status === 'unknown' || frameworks.status === 'unresolved') {
            rows.push({
                projectId: project.identity.id,
                kind: 'target-framework',
                status: frameworks.status,
                detail: frameworks.detail ?? 'Target framework is not known.',
            });
        }
        for (const reference of project.projectReferences) {
            if (reference.status === 'resolved') {
                continue;
            }
            rows.push({
                projectId: project.identity.id,
                kind: 'project-reference',
                status: reference.status,
                detail: reference.detail ?? reference.include,
            });
        }
        if (project.reqnroll.status === 'invalid') {
            rows.push({
                projectId: project.identity.id,
                kind: 'reqnroll-config',
                status: 'invalid',
                detail: project.reqnroll.formatError ?? 'reqnroll.json is invalid.',
            });
        }
        for (const binding of project.reqnroll.bindingAssemblies) {
            const name = binding.assemblyName;
            if (name.status === 'resolved' || name.status === 'inferred') {
                continue;
            }
            rows.push({
                projectId: project.identity.id,
                kind: 'binding-assembly',
                status: name.status,
                detail: name.detail ?? 'Binding assembly name is not known.',
            });
        }
    }
    return rows;
}

function findCsprojFiles(root: string): string[] {
    const found: string[] = [];
    const stack = [root];
    const seen = new Set<string>();
    while (stack.length > 0) {
        const dir = stack.pop();
        if (!dir || seen.has(dir)) {
            continue;
        }
        seen.add(dir);
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (EXCLUDE_DIR_NAMES.has(entry.name)) {
                continue;
            }
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csproj')) {
                found.push(full);
            }
        }
    }
    found.sort();
    return found;
}
