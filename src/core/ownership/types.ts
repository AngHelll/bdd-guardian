/**
 * Static evidence for .NET projects and Reqnroll binding load.
 *
 * This module describes what a project file and a reqnroll.json say.
 * It does not decide whether a step matches, and it has no single
 * `accessible` flag: compile reference, binding load, and the host
 * assembly stay separate because those relations are not equivalent.
 */

/** How far a static read got. */
export type ResolutionStatus = 'resolved' | 'inferred' | 'unresolved' | 'unknown';

/**
 * How a property value was obtained.
 * `derived` is the file-name default for an absent AssemblyName.
 * It is not a value observed at runtime.
 */
export type PropertyResolution = 'explicit' | 'inherited' | 'derived' | 'unknown' | 'unresolved';

/**
 * Where a value came from.
 * `project-file-name` is the MSBuild default for an absent AssemblyName
 * (the file name, never the directory name).
 * `directory-build-props` is the nearest Directory.Build.props whose
 * unconditional literals were applied before the project file.
 */
export type EvidenceSource =
    | 'csproj-property'
    | 'csproj-item'
    | 'project-file-name'
    | 'reqnroll-json'
    | 'directory-import'
    | 'directory-build-props'
    | 'absent';

/** A value together with the reason it is or is not known. */
export interface StaticValue<T> {
    readonly status: ResolutionStatus;
    readonly value: T | null;
    readonly raw: string | null;
    readonly source: EvidenceSource;
    readonly detail: string | null;
    /** Present on MSBuild properties. Omitted for other static values. */
    readonly resolution?: PropertyResolution;
    /** File that contributed the value, when one did. */
    readonly originPath?: string | null;
    /** Property element or attribute that contributed the value. */
    readonly propertyName?: string | null;
}

/** Identity of one project file. A directory may contain more than one. */
export interface ProjectIdentity {
    /** Absolute path of the `.csproj`. */
    readonly id: string;
    readonly manifestPath: string;
    readonly directoryPath: string;
    readonly projectFileName: string;
    readonly directoryName: string;
}

/** Assembly name declared by the project, or the documented file-name default. */
export interface AssemblyIdentity {
    readonly name: StaticValue<string>;
}

/**
 * A `ProjectReference` item.
 * `resolved` means the included file exists. It does not mean Reqnroll loads it.
 */
export interface ProjectReferenceEvidence {
    readonly kind: 'compile-reference';
    readonly include: string;
    readonly candidatePath: string | null;
    readonly status: 'resolved' | 'unresolved' | 'unknown';
    readonly source: 'csproj-item';
    readonly detail: string | null;
}

/**
 * One entry of `reqnroll.json` `bindingAssemblies`.
 * This is a load declaration, not a compile reference.
 */
export interface BindingAssemblyEvidence {
    readonly kind: 'binding-load';
    readonly assemblyName: StaticValue<string>;
    readonly configPath: string;
    readonly source: 'reqnroll-json';
}

/**
 * The assembly of the project being read: the one that executes its own tests.
 * Distinct from both `ProjectReferenceEvidence` and `BindingAssemblyEvidence`.
 */
export interface HostAssemblyEvidence {
    readonly kind: 'host-assembly';
    readonly assembly: AssemblyIdentity;
    readonly detail: string;
}

/** Nearest Directory.Build.props whose literal properties were read. */
export interface EvaluatedImportEvidence {
    readonly kind: 'evaluated-import';
    readonly path: string;
    readonly role: 'directory-build-props';
    readonly status: 'resolved';
    readonly source: 'directory-import';
    readonly detail: string;
}

/**
 * A file or import that can still change properties and was not applied.
 * Directory.Build.targets is always here: it is imported after the project.
 */
export interface UnevaluatedImportEvidence {
    readonly kind: 'unevaluated-import';
    readonly path: string;
    readonly status: 'unknown' | 'unresolved';
    readonly source: 'directory-import';
    readonly detail: string;
}

export type ReqnrollConfigStatus = 'present' | 'absent' | 'invalid';

export interface ReqnrollConfigRead {
    readonly status: ReqnrollConfigStatus;
    /** Path that was read, or the path that was looked up when the file is absent. */
    readonly configPath: string | null;
    readonly bindingAssemblies: readonly BindingAssemblyEvidence[];
    readonly formatError: string | null;
}

export interface DotnetProject {
    readonly identity: ProjectIdentity;
    readonly assembly: AssemblyIdentity;
    readonly targetFrameworks: StaticValue<readonly string[]>;
    readonly projectReferences: readonly ProjectReferenceEvidence[];
    readonly reqnroll: ReqnrollConfigRead;
    readonly hostAssembly: HostAssemblyEvidence | null;
    readonly evaluatedImports: readonly EvaluatedImportEvidence[];
    readonly unevaluatedImports: readonly UnevaluatedImportEvidence[];
    readonly parseError: string | null;
}

export interface ProjectGraph {
    readonly projects: readonly DotnetProject[];
}

export interface IncompleteRelation {
    readonly projectId: string;
    readonly kind:
        | 'csproj-parse'
        | 'assembly-name'
        | 'target-framework'
        | 'project-reference'
        | 'reqnroll-config'
        | 'binding-assembly';
    readonly status: 'unresolved' | 'unknown' | 'invalid';
    readonly detail: string;
}
