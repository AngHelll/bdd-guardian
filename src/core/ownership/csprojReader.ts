/**
 * Static `.csproj` reader.
 *
 * MSBuild is not executed. Property values come from msbuildProperties.ts:
 * nearest Directory.Build.props, then this file. Directory.Build.targets
 * is not read. An absent AssemblyName is derived from the project file
 * name only when nothing unevaluated can still set it. The directory name
 * is never used as that default.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveStaticProperties } from './msbuildProperties';
import { attribute, childElements, localName, parseXmlDocument } from './xmlLite';
import type { XmlElement } from './xmlLite';
import type {
    AssemblyIdentity,
    DotnetProject,
    EvaluatedImportEvidence,
    ProjectIdentity,
    ProjectReferenceEvidence,
    ReqnrollConfigRead,
    UnevaluatedImportEvidence,
} from './types';

const HOST_DETAIL =
    'Execution assembly of this project. Distinct from ProjectReference and from bindingAssemblies.';

export interface CsprojReadInput {
    readonly text: string;
    readonly manifestPath: string;
    readonly reqnroll: ReqnrollConfigRead;
    /** Ancestor walk for Directory.Build.* stops at this directory. */
    readonly scanRoot?: string;
}

export function parseProjectFile(input: CsprojReadInput): DotnetProject {
    const manifestPath = path.resolve(input.manifestPath);
    const identity = projectIdentity(manifestPath);
    const parsed = parseXmlDocument(input.text);
    const rootIsProject = parsed.root !== null && localName(parsed.root.name).toLowerCase() === 'project';
    const properties = resolveStaticProperties({
        project: rootIsProject ? parsed.root : null,
        manifestPath,
        projectFileName: identity.projectFileName,
        scanRoot: input.scanRoot,
    });
    if (parsed.error || !parsed.root || !rootIsProject) {
        return unreadable(
            identity,
            input.reqnroll,
            properties.evaluatedImports,
            properties.unevaluatedImports,
            parsed.error ?? (parsed.root ? `Root element is <${parsed.root.name}>, not <Project>` : 'XML document is empty')
        );
    }

    return {
        identity,
        assembly: properties.assembly,
        targetFrameworks: properties.targetFrameworks,
        projectReferences: projectReferences(parsed.root, manifestPath),
        reqnroll: input.reqnroll,
        hostAssembly: {
            kind: 'host-assembly',
            assembly: properties.assembly,
            detail: HOST_DETAIL,
        },
        evaluatedImports: properties.evaluatedImports,
        unevaluatedImports: properties.unevaluatedImports,
        parseError: null,
    };
}

function projectIdentity(manifestPath: string): ProjectIdentity {
    const directoryPath = path.dirname(manifestPath);
    return {
        id: manifestPath,
        manifestPath,
        directoryPath,
        projectFileName: path.basename(manifestPath),
        directoryName: path.basename(directoryPath),
    };
}

function unreadable(
    identity: ProjectIdentity,
    reqnroll: ReqnrollConfigRead,
    evaluatedImports: readonly EvaluatedImportEvidence[],
    unevaluatedImports: readonly UnevaluatedImportEvidence[],
    parseError: string
): DotnetProject {
    const assembly = unknownAssembly(parseError);
    return {
        identity,
        assembly,
        targetFrameworks: {
            status: 'unknown',
            resolution: 'unknown',
            value: null,
            raw: null,
            source: 'absent',
            originPath: null,
            propertyName: 'TargetFramework',
            detail: 'Target framework was not read because the project file did not parse.',
        },
        projectReferences: [],
        reqnroll,
        hostAssembly: null,
        evaluatedImports,
        unevaluatedImports,
        parseError,
    };
}

function unknownAssembly(detail: string): AssemblyIdentity {
    return {
        name: {
            status: 'unknown',
            resolution: 'unknown',
            value: null,
            raw: null,
            source: 'absent',
            originPath: null,
            propertyName: 'AssemblyName',
            detail,
        },
    };
}

function projectReferences(project: XmlElement, manifestPath: string): readonly ProjectReferenceEvidence[] {
    const references: ProjectReferenceEvidence[] = [];
    for (const group of childElements(project, 'ItemGroup')) {
        const groupConditional = attribute(group, 'Condition') !== undefined;
        for (const item of childElements(group, 'ProjectReference')) {
            references.push(oneReference(item, manifestPath, groupConditional));
        }
    }
    return references;
}

function oneReference(
    item: XmlElement,
    manifestPath: string,
    groupConditional: boolean
): ProjectReferenceEvidence {
    const include = attribute(item, 'Include') ?? '';
    const conditional = groupConditional || attribute(item, 'Condition') !== undefined;
    const expandable = include.includes('$(');
    const candidatePath = !expandable && include.trim().length > 0
        ? resolveMsbuildPath(manifestPath, include)
        : null;

    if (conditional) {
        return {
            kind: 'compile-reference',
            include,
            candidatePath,
            status: 'unknown',
            source: 'csproj-item',
            detail: 'ProjectReference depends on an MSBuild condition that was not evaluated.',
        };
    }
    if (include.trim().length === 0 || expandable) {
        return {
            kind: 'compile-reference',
            include,
            candidatePath: null,
            status: 'unresolved',
            source: 'csproj-item',
            detail: 'ProjectReference Include is empty or contains an MSBuild property that was not evaluated.',
        };
    }
    if (candidatePath && fs.existsSync(candidatePath)) {
        return {
            kind: 'compile-reference',
            include,
            candidatePath,
            status: 'resolved',
            source: 'csproj-item',
            detail: null,
        };
    }
    return {
        kind: 'compile-reference',
        include,
        candidatePath,
        status: 'unresolved',
        source: 'csproj-item',
        detail: 'ProjectReference does not point at an existing file.',
    };
}

/** MSBuild allows `\` in relative paths. That is path syntax, not property evaluation. */
export function resolveMsbuildPath(manifestPath: string, include: string): string {
    const normalized = include.trim().replace(/\\/g, '/');
    return path.resolve(path.dirname(manifestPath), normalized);
}

export function absentReqnrollConfig(configPath: string | null): ReqnrollConfigRead {
    return {
        status: 'absent',
        configPath,
        bindingAssemblies: [],
        formatError: null,
    };
}
