/**
 * File ownership candidates for .cs and .feature files.
 *
 * A file may relate to several projects. Directory containment is not
 * compile inclusion, and none of these relations is a runtime fact.
 * This module does not modify the project graph or the resolver.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveMsbuildPath } from './csprojReader';
import { attribute, childElements, localName, parseXmlDocument } from './xmlLite';
import type { XmlElement } from './xmlLite';
import type { DotnetProject, ProjectGraph } from './types';

export type FileRelationKind =
    | 'explicit-compile-include'
    | 'explicit-compile-remove'
    | 'default-compile-candidate'
    | 'linked-compile-include'
    | 'explicit-feature-include'
    | 'feature-candidate'
    | 'directory-containment'
    | 'unknown';

export type OwnershipConfidence = 'declared' | 'convention' | 'physical' | 'none';

export type OwnershipStatus = 'resolved' | 'inferred' | 'unknown' | 'unresolved';

export interface FileIdentity {
    readonly path: string;
    readonly fileName: string;
    readonly extension: string;
}

export interface FileProjectRelation {
    readonly projectId: string;
    readonly kind: FileRelationKind;
    readonly status: OwnershipStatus;
    readonly confidence: OwnershipConfidence;
    readonly originPath: string | null;
    readonly evidence: string;
    readonly detail: string | null;
}

export interface FileOwnership {
    readonly identity: FileIdentity;
    readonly relations: readonly FileProjectRelation[];
    /**
     * Set when no relation was found. An empty relation list is not proof
     * that the file belongs to no project.
     */
    readonly evidenceGap: string | null;
}

export interface FileOwnershipReport {
    readonly files: readonly FileOwnership[];
}

const FEATURE_ITEMS = new Set([
    'none',
    'content',
    'embeddedresource',
    'reqnrollfeaturefiles',
    'specflowfeaturefiles',
]);

const OUTPUT_SEGMENTS = new Set(['bin', 'obj']);

const NO_RELATION =
    'No project relationship was found. This does not prove that the file belongs to no project.';

interface ItemDecl {
    readonly action: 'include' | 'remove';
    readonly itemName: string;
    readonly raw: string;
    readonly originPath: string;
    readonly conditional: boolean;
    readonly dynamic: boolean;
    readonly glob: boolean;
    readonly resolvedPath: string | null;
    readonly evidence: string;
}

type DefaultMode = 'allow' | 'off' | 'uncertain';

interface ProjectFacts {
    readonly items: readonly ItemDecl[];
    readonly mode: DefaultMode;
    readonly uncertainty: string | null;
}

export function analyzeFileOwnership(
    graph: ProjectGraph,
    files: readonly string[]
): FileOwnershipReport {
    const facts = new Map<string, ProjectFacts>();
    const seen = new Set<string>();
    const owned: FileOwnership[] = [];
    for (const file of files) {
        const identity = fileIdentity(file);
        if (seen.has(identity.path)) {
            continue;
        }
        seen.add(identity.path);
        const relations: FileProjectRelation[] = [];
        for (const project of graph.projects) {
            relations.push(...relationsFor(project, identity, facts));
        }
        relations.sort(compareRelations);
        owned.push({
            identity,
            relations,
            evidenceGap: relations.length === 0 ? NO_RELATION : null,
        });
    }
    return { files: owned };
}

function relationsFor(
    project: DotnetProject,
    file: FileIdentity,
    facts: Map<string, ProjectFacts>
): FileProjectRelation[] {
    const contained = isInside(project.identity.directoryPath, file.path);
    if (project.parseError) {
        if (!contained) {
            return [];
        }
        return [
            containment(project, file),
            unknownRelation(
                project,
                project.parseError,
                'The project file did not parse, so compile and feature participation are unknown.'
            ),
        ];
    }

    const projectFacts = factsFor(project, facts);
    const relations: FileProjectRelation[] = [];
    if (contained) {
        relations.push(containment(project, file));
    }

    if (file.extension === '.cs') {
        relations.push(...csharpRelations(project, file, projectFacts, contained));
    } else if (file.extension === '.feature') {
        relations.push(...featureRelations(project, file, projectFacts, contained));
    }
    return relations;
}

function csharpRelations(
    project: DotnetProject,
    file: FileIdentity,
    facts: ProjectFacts,
    contained: boolean
): FileProjectRelation[] {
    const compileItems = facts.items.filter((item) => item.itemName === 'compile' && item.resolvedPath === file.path);
    const outcome = lastOutcome(compileItems);
    const relations: FileProjectRelation[] = [];
    if (outcome?.kind === 'unknown') {
        relations.push(unknownRelation(project, outcome.item.evidence, uncertainItemReason(outcome.item)));
    } else if (outcome) {
        const linked = outcome.kind === 'include' && !isInside(project.identity.directoryPath, file.path);
        const kind: FileRelationKind = outcome.kind === 'remove'
            ? 'explicit-compile-remove'
            : linked
                ? 'linked-compile-include'
                : 'explicit-compile-include';
        relations.push(declaredRelation(project, kind, outcome.item, facts));
    }

    if (contained && facts.mode === 'allow' && !outcome && !isOutputPath(project.identity.directoryPath, file.path)) {
        relations.push({
            projectId: project.identity.id,
            kind: 'default-compile-candidate',
            status: 'inferred',
            confidence: 'convention',
            originPath: project.identity.manifestPath,
            evidence: 'SDK-style default compile items',
            detail: 'The file is under an SDK project and no static rule excluded it. This is not a confirmed Compile item and not a runtime fact.',
        });
    } else if (contained && facts.mode === 'uncertain' && relations.length === 0) {
        relations.push(unknownRelation(
            project,
            facts.uncertainty ?? 'Compile participation could not be determined.',
            'Default compile inclusion was not applied.'
        ));
    }
    return relations;
}

function featureRelations(
    project: DotnetProject,
    file: FileIdentity,
    facts: ProjectFacts,
    contained: boolean
): FileProjectRelation[] {
    const featureItems = facts.items.filter((item) => FEATURE_ITEMS.has(item.itemName) && item.resolvedPath === file.path);
    const outcome = lastOutcome(featureItems);
    const relations: FileProjectRelation[] = [];
    if (outcome?.kind === 'unknown') {
        relations.push(unknownRelation(project, outcome.item.evidence, uncertainItemReason(outcome.item)));
    } else if (outcome?.kind === 'include') {
        relations.push(declaredRelation(project, 'explicit-feature-include', outcome.item, facts));
    }
    if (contained) {
        relations.push({
            projectId: project.identity.id,
            kind: 'feature-candidate',
            status: 'inferred',
            confidence: 'physical',
            originPath: project.identity.manifestPath,
            evidence: 'Feature file inside the project directory',
            detail: 'Reqnroll participation was not confirmed from the project file. Physical location is not test participation and not a runtime fact.',
        });
    }
    return relations;
}

function declaredRelation(
    project: DotnetProject,
    kind: FileRelationKind,
    item: ItemDecl,
    facts: ProjectFacts
): FileProjectRelation {
    const poisoned = facts.mode === 'uncertain';
    return {
        projectId: project.identity.id,
        kind,
        status: poisoned ? 'unknown' : 'resolved',
        confidence: 'declared',
        originPath: item.originPath,
        evidence: item.evidence,
        detail: poisoned
            ? 'The declaration is present, but an unevaluated import, glob, or condition may change the effective item list.'
            : null,
    };
}

function containment(project: DotnetProject, file: FileIdentity): FileProjectRelation {
    return {
        projectId: project.identity.id,
        kind: 'directory-containment',
        status: 'inferred',
        confidence: 'physical',
        originPath: project.identity.manifestPath,
        evidence: path.relative(project.identity.directoryPath, file.path),
        detail: 'Physical location only. This does not establish compile inclusion or test participation.',
    };
}

function unknownRelation(project: DotnetProject, evidence: string, detail: string): FileProjectRelation {
    return {
        projectId: project.identity.id,
        kind: 'unknown',
        status: 'unknown',
        confidence: 'none',
        originPath: project.identity.manifestPath,
        evidence,
        detail,
    };
}

function factsFor(project: DotnetProject, cache: Map<string, ProjectFacts>): ProjectFacts {
    const cached = cache.get(project.identity.id);
    if (cached) {
        return cached;
    }
    const documents = sourceDocuments(project);
    const items = documents.flatMap((document) => document.items);
    const enable = enableDefaultCompileItems(documents);
    const mode = defaultMode(project, items, enable);
    const facts: ProjectFacts = {
        items,
        mode: mode.mode,
        uncertainty: mode.uncertainty,
    };
    cache.set(project.identity.id, facts);
    return facts;
}

function defaultMode(
    project: DotnetProject,
    items: readonly ItemDecl[],
    enable: 'true' | 'false' | 'absent' | 'unknown'
): { mode: DefaultMode; uncertainty: string | null } {
    if (project.unevaluatedImports.length > 0) {
        return { mode: 'uncertain', uncertainty: project.unevaluatedImports[0].detail };
    }
    if (enable === 'unknown') {
        return { mode: 'uncertain', uncertainty: 'EnableDefaultCompileItems was not evaluated.' };
    }
    const blocking = items.find((item) => item.itemName === 'compile' && (item.glob || item.dynamic));
    if (blocking) {
        return { mode: 'uncertain', uncertainty: blocking.evidence };
    }
    if (enable === 'false' || (enable === 'absent' && !isSdkProject(project))) {
        return { mode: 'off', uncertainty: null };
    }
    return { mode: 'allow', uncertainty: null };
}

function isSdkProject(project: DotnetProject): boolean {
    const text = readText(project.identity.manifestPath);
    if (text === null) {
        return false;
    }
    const parsed = parseXmlDocument(text);
    if (!parsed.root) {
        return false;
    }
    const sdk = attribute(parsed.root, 'Sdk') ?? '';
    return sdk.toLowerCase().includes('microsoft.net.sdk');
}

interface SourceDocument {
    readonly originPath: string;
    readonly root: XmlElement | null;
    readonly items: readonly ItemDecl[];
}

function sourceDocuments(project: DotnetProject): readonly SourceDocument[] {
    const documents: SourceDocument[] = [];
    for (const imported of project.evaluatedImports) {
        documents.push(loadDocument(imported.path));
    }
    documents.push(loadDocument(project.identity.manifestPath));
    return documents;
}

function loadDocument(originPath: string): SourceDocument {
    const text = readText(originPath);
    const parsed = text === null ? null : parseXmlDocument(text).root;
    return {
        originPath,
        root: parsed,
        items: parsed ? collectItems(parsed, originPath) : [],
    };
}

function collectItems(root: XmlElement, originPath: string): ItemDecl[] {
    const items: ItemDecl[] = [];
    for (const group of childElements(root, 'ItemGroup')) {
        const groupConditional = attribute(group, 'Condition') !== undefined;
        for (const item of group.children) {
            const itemName = localName(item.name).toLowerCase();
            if (itemName !== 'compile' && !FEATURE_ITEMS.has(itemName)) {
                continue;
            }
            pushAction(items, item, itemName, 'Include', 'include', groupConditional, originPath);
            pushAction(items, item, itemName, 'Remove', 'remove', groupConditional, originPath);
        }
    }
    return items;
}

function pushAction(
    items: ItemDecl[],
    item: XmlElement,
    itemName: string,
    attributeName: 'Include' | 'Remove',
    action: 'include' | 'remove',
    groupConditional: boolean,
    originPath: string
): void {
    const raw = attribute(item, attributeName);
    if (raw === undefined) {
        return;
    }
    const conditional = groupConditional || attribute(item, 'Condition') !== undefined;
    const dynamic = raw.includes('$(') || raw.includes('@(') || raw.includes('%(') || raw.includes('$[');
    const glob = raw.includes('*') || raw.includes('?');
    const resolvedPath = !dynamic && !glob ? resolveMsbuildPath(originPath, raw) : null;
    const label = itemName === 'compile' ? 'Compile' : localName(item.name);
    items.push({
        action,
        itemName,
        raw,
        originPath,
        conditional,
        dynamic,
        glob,
        resolvedPath,
        evidence: `${label} ${attributeName}="${raw}"`,
    });
}

function enableDefaultCompileItems(documents: readonly SourceDocument[]): 'true' | 'false' | 'absent' | 'unknown' {
    let result: 'true' | 'false' | 'absent' | 'unknown' = 'absent';
    for (const document of documents) {
        if (!document.root) {
            continue;
        }
        for (const group of childElements(document.root, 'PropertyGroup')) {
            const groupConditional = attribute(group, 'Condition') !== undefined;
            for (const property of childElements(group, 'EnableDefaultCompileItems')) {
                const conditional = groupConditional || attribute(property, 'Condition') !== undefined;
                const raw = property.text.trim();
                if (conditional || raw.includes('$(') || raw.includes('$[')) {
                    return 'unknown';
                }
                if (raw.toLowerCase() === 'true') {
                    result = 'true';
                } else if (raw.toLowerCase() === 'false') {
                    result = 'false';
                } else {
                    return 'unknown';
                }
            }
        }
    }
    return result;
}

function lastOutcome(items: readonly ItemDecl[]): { kind: 'include' | 'remove' | 'unknown'; item: ItemDecl } | null {
    let selected: { kind: 'include' | 'remove' | 'unknown'; item: ItemDecl } | null = null;
    for (const item of items) {
        if (item.conditional || item.dynamic || item.glob || !item.resolvedPath) {
            selected = { kind: 'unknown', item };
            continue;
        }
        selected = { kind: item.action, item };
    }
    return selected;
}

function uncertainItemReason(item: ItemDecl): string {
    if (item.conditional) {
        return 'The item has an MSBuild condition that was not evaluated.';
    }
    if (item.glob) {
        return 'The item glob was not expanded.';
    }
    return 'The item path uses a property or transform that was not evaluated.';
}

function fileIdentity(file: string): FileIdentity {
    const full = path.resolve(file);
    return {
        path: full,
        fileName: path.basename(full),
        extension: path.extname(full).toLowerCase(),
    };
}

function isInside(directory: string, filePath: string): boolean {
    const relative = path.relative(path.resolve(directory), path.resolve(filePath));
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function isOutputPath(directory: string, filePath: string): boolean {
    const relative = path.relative(path.resolve(directory), path.resolve(filePath));
    return relative.split(/[\\/]/).some((segment) => OUTPUT_SEGMENTS.has(segment.toLowerCase()));
}

function compareRelations(left: FileProjectRelation, right: FileProjectRelation): number {
    const project = left.projectId.localeCompare(right.projectId);
    if (project !== 0) {
        return project;
    }
    return left.kind.localeCompare(right.kind);
}

function readText(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}
