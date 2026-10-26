/**
 * Project and binding-load evidence.
 * Not consulted by the resolver or the BDD Map.
 */

export type {
    AssemblyIdentity,
    BindingAssemblyEvidence,
    DotnetProject,
    EvaluatedImportEvidence,
    EvidenceSource,
    HostAssemblyEvidence,
    IncompleteRelation,
    ProjectGraph,
    ProjectIdentity,
    ProjectReferenceEvidence,
    PropertyResolution,
    ReqnrollConfigRead,
    ReqnrollConfigStatus,
    ResolutionStatus,
    StaticValue,
    UnevaluatedImportEvidence,
} from './types';

export { parseXmlDocument } from './xmlLite';
export { readReqnrollConfig } from './reqnrollConfigReader';
export { absentReqnrollConfig, parseProjectFile, resolveMsbuildPath } from './csprojReader';
export {
    bindingAssembliesOf,
    incompleteRelations,
    listProjects,
    loadProjectGraph,
    projectReferencesOf,
} from './projectGraph';
export { analyzeFileOwnership } from './fileOwnership';
export { explainStep } from './stepDiagnosis';
export type {
    AssemblyNameMatch,
    DiagnosisConfidence,
    DiagnosisExplanation,
    DiagnosisInput,
    DiagnosisLayers,
    DiagnosisRelationCite,
    ExplanationKind,
    StepDiagnosis,
} from './stepDiagnosis';
export type {
    FileIdentity,
    FileOwnership,
    FileOwnershipReport,
    FileProjectRelation,
    FileRelationKind,
    OwnershipConfidence,
    OwnershipStatus,
} from './fileOwnership';
