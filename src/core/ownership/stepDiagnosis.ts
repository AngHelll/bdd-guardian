/**
 * Explains an existing resolver result with project and ownership evidence.
 *
 * The resolver status is copied through. This module does not reclassify
 * steps, does not read score preferences, and does not confirm runtime load.
 */

import * as path from 'path';
import type { Binding, MatchStatus, ResolveResult } from '../domain/types';
import type { FileOwnership, FileOwnershipReport, FileProjectRelation } from './fileOwnership';
import type { ProjectGraph } from './types';

export type ExplanationKind =
    | 'same-project-overlap'
    | 'cross-project-candidates'
    | 'binding-load-evidence'
    | 'insufficient-ownership-evidence'
    | 'unresolved-project-context'
    | 'keyword-fallback'
    | 'scope-not-selected';

export type DiagnosisConfidence = 'declared' | 'convention' | 'physical' | 'none';

export type AssemblyNameMatch = 'none' | 'derived-file-name' | 'explicit-assembly-name';

export interface DiagnosisLayers {
    /** The resolver already matched this text. Ownership does not create the match. */
    readonly textualMatch: boolean;
    /** A project relation exists for a file in this explanation. */
    readonly fileOwnership: boolean;
    /** Explicit, linked, or SDK-default compile evidence. Not a built assembly. */
    readonly potentialCompile: boolean;
    /** A bindingAssemblies entry or its absence was read. Not runner load. */
    readonly loadConfiguration: boolean;
    /** Always false. This component does not execute the runner. */
    readonly runtimeAccessibility: false;
}

export interface DiagnosisRelationCite {
    readonly file: string;
    readonly projectId: string;
    readonly kind: string;
    readonly confidence: string;
    readonly originPath: string | null;
    readonly evidence: string;
}

export interface DiagnosisExplanation {
    readonly kind: ExplanationKind;
    readonly confidence: DiagnosisConfidence;
    readonly files: readonly string[];
    readonly projectIds: readonly string[];
    readonly relations: readonly DiagnosisRelationCite[];
    readonly provenance: readonly string[];
    readonly missing: readonly string[];
    readonly detail: string;
    readonly layers: DiagnosisLayers;
    readonly runtimeConfirmed: false;
    readonly nameMatch: AssemblyNameMatch;
}

export interface StepDiagnosis {
    readonly resolverStatus: MatchStatus;
    readonly resolverCandidateCount: number;
    readonly explanations: readonly DiagnosisExplanation[];
    readonly missing: readonly string[];
    readonly runtimeConfirmed: false;
}

export interface DiagnosisInput {
    readonly result: ResolveResult;
    /** Bindings that were available when the result was produced. Not matched again. */
    readonly poolBindings?: readonly Binding[];
    readonly graph: ProjectGraph;
    readonly ownership: FileOwnershipReport;
}

const RUNTIME_MISSING = 'Runtime accessibility was not executed by this component.';
const ATTRIBUTE_MISSING = 'A step attribute in a source file is not evidence that the class is a runnable binding.';
const COMPILE_KINDS = new Set([
    'explicit-compile-include',
    'linked-compile-include',
    'default-compile-candidate',
]);

export function explainStep(input: DiagnosisInput): StepDiagnosis {
    const status = input.result.status;
    const candidates = input.result.candidates;
    const stepPath = pathKey(input.result.step.uri.fsPath);
    const candidateFiles = unique(candidates.map((candidate) => pathKey(candidate.binding.uri.fsPath)));
    const involved = unique([stepPath, ...candidateFiles]);
    const explanations: DiagnosisExplanation[] = [];

    if (candidates.some((candidate) => candidate.keywordMatched === false)) {
        explanations.push(explanation({
            kind: 'keyword-fallback',
            confidence: 'declared',
            files: involved,
            projectIds: [],
            relations: [],
            provenance: ['resolver candidate keywordMatched is false'],
            missing: [RUNTIME_MISSING, 'Whether the runner accepts a different keyword is not in the project graph.'],
            detail: 'The resolver selected a binding whose keyword differs from the step. That selection is not evidence the runner accepts it.',
            layers: layers({ textualMatch: true }),
            nameMatch: 'none',
        }));
    }

    const scopeHits = scopeNotSelected(input, stepPath);
    if (scopeHits.length > 0) {
        explanations.push(explanation({
            kind: 'scope-not-selected',
            confidence: 'none',
            files: unique([stepPath, ...scopeHits.map((binding) => pathKey(binding.uri.fsPath))]),
            projectIds: [],
            relations: cites(input.ownership, [stepPath, ...scopeHits.map((binding) => pathKey(binding.uri.fsPath))]),
            provenance: scopeHits.map((binding) => `${binding.methodName} pattern "${binding.patternRaw}" scope [${binding.scopeTags.join(', ')}]`),
            missing: [RUNTIME_MISSING, 'Scope was not re-evaluated. Pattern text was compared as a string, not by the resolver regex.'],
            detail: 'The resolver selected no candidate. Bindings with the same pattern text declare scope tags and were not selected. This does not reclassify the step.',
            layers: layers({ textualMatch: false, fileOwnership: true }),
            nameMatch: 'none',
        }));
    }

    const compileSets = candidates.map((candidate) => compileProjects(ownershipOf(input.ownership, pathKey(candidate.binding.uri.fsPath))));
    if (candidates.length >= 2 && compileSets.every((set) => set.length > 0)) {
        const shared = intersection(compileSets);
        if (shared.length > 0) {
            explanations.push(projectExplanation(
                'same-project-overlap',
                input,
                involved,
                shared,
                'The resolver candidates have compile evidence in the same project. Overlap inside that project is not removed, and runtime ambiguity was not re-checked.',
                { textualMatch: true, fileOwnership: true, potentialCompile: true }
            ));
        } else {
            explanations.push(projectExplanation(
                'cross-project-candidates',
                input,
                involved,
                unique(compileSets.flat()),
                'The resolver candidates have compile evidence in disjoint projects. That is not proof the runner cannot see both, and neither candidate was removed.',
                { textualMatch: true, fileOwnership: true, potentialCompile: true }
            ));
        }
    }

    const weakFiles = involved.filter((file) => !hasCompileEvidence(ownershipOf(input.ownership, file)));
    if (candidateFiles.length > 0 && weakFiles.some((file) => file !== stepPath || candidateFiles.includes(file))) {
        const subject = weakFiles.filter((file) => candidateFiles.includes(file) || file === stepPath);
        if (subject.some((file) => candidateFiles.includes(file))) {
            explanations.push(explanation({
                kind: 'insufficient-ownership-evidence',
                confidence: 'physical',
                files: subject,
                projectIds: unique(subject.flatMap((file) => relatedProjects(ownershipOf(input.ownership, file)))),
                relations: cites(input.ownership, subject),
                provenance: subject.map((file) => file),
                missing: [RUNTIME_MISSING, 'Compile inclusion is not explicit for at least one matched file. Directory presence is not an executable binding.'],
                detail: 'At least one matched file has no explicit, linked, or SDK-default compile evidence. The resolver result is unchanged.',
                layers: layers({ textualMatch: true, fileOwnership: true, potentialCompile: false }),
                nameMatch: 'none',
            }));
        }
    }

    const otherFrameworkFiles = otherFrameworkPool(input, candidateFiles);
    if (involved.some((file) => (ownershipOf(input.ownership, file)?.relations.length ?? 0) === 0)) {
        explanations.push(explanation({
            kind: 'unresolved-project-context',
            confidence: 'none',
            files: unique([...involved, ...otherFrameworkFiles]),
            projectIds: [],
            relations: [],
            provenance: [],
            missing: [RUNTIME_MISSING, 'No project relationship was found for at least one file. That does not prove the file is unowned. Other frameworks are outside this .NET graph.'],
            detail: 'Project context is incomplete. Folder names were not turned into projects, and no candidate was discarded.',
            layers: layers({ textualMatch: candidateFiles.length > 0 }),
            nameMatch: 'none',
        }));
    }

    const multiOwned = involved.filter((file) => relatedProjects(ownershipOf(input.ownership, file)).length > 1);
    if (multiOwned.length > 0) {
        const projectIds = unique(multiOwned.flatMap((file) => relatedProjects(ownershipOf(input.ownership, file))));
        explanations.push(explanation({
            kind: 'unresolved-project-context',
            confidence: 'physical',
            files: multiOwned,
            projectIds,
            relations: cites(input.ownership, multiOwned),
            provenance: projectIds,
            missing: [RUNTIME_MISSING, 'Multiple project relations exist. Nearness was not used to pick one owner.'],
            detail: 'One or more files relate to more than one project. All of those projects stay listed.',
            layers: layers({ textualMatch: candidateFiles.length > 0, fileOwnership: true, potentialCompile: multiOwned.some((file) => hasCompileEvidence(ownershipOf(input.ownership, file))) }),
            nameMatch: 'none',
        }));
    }

    explanations.push(...loadEvidence(input, stepPath, candidateFiles));

    explanations.sort((left, right) => left.kind.localeCompare(right.kind));
    return {
        resolverStatus: status,
        resolverCandidateCount: candidates.length,
        explanations,
        missing: [
            RUNTIME_MISSING,
            ...(candidateFiles.some((file) => file.endsWith('.cs')) ? [ATTRIBUTE_MISSING] : []),
        ],
        runtimeConfirmed: false,
    };
}

function loadEvidence(input: DiagnosisInput, stepPath: string, candidateFiles: readonly string[]): DiagnosisExplanation[] {
    const featureProjects = relatedProjects(ownershipOf(input.ownership, stepPath));
    const found: DiagnosisExplanation[] = [];
    for (const featureProjectId of featureProjects) {
        const featureProject = input.graph.projects.find((project) => project.identity.id === featureProjectId);
        if (!featureProject) {
            continue;
        }
        const declared = featureProject.reqnroll.bindingAssemblies.filter((entry) => entry.assemblyName.value);
        for (const candidateFile of candidateFiles) {
            for (const candidateProjectId of compileProjects(ownershipOf(input.ownership, candidateFile))) {
                if (candidateProjectId === featureProjectId) {
                    continue;
                }
                const candidateProject = input.graph.projects.find((project) => project.identity.id === candidateProjectId);
                if (!candidateProject) {
                    continue;
                }
                const referenced = featureProject.projectReferences.some((reference) =>
                    reference.kind === 'compile-reference'
                    && reference.status === 'resolved'
                    && reference.candidatePath === candidateProject.identity.manifestPath);
                const assemblyValue = candidateProject.assembly.name.value;
                const named = declared.some((entry) => entry.assemblyName.value === assemblyValue);
                let nameMatch: AssemblyNameMatch = 'none';
                if (named && candidateProject.assembly.name.resolution === 'explicit') {
                    nameMatch = 'explicit-assembly-name';
                } else if (named && candidateProject.assembly.name.resolution === 'derived') {
                    nameMatch = 'derived-file-name';
                }
                if (declared.length === 0 && !referenced) {
                    continue;
                }
                const provenance = [
                    ...declared.map((entry) => `${entry.configPath} bindingAssemblies "${entry.assemblyName.value}"`),
                    ...featureProject.projectReferences
                        .filter((reference) => reference.candidatePath === candidateProject.identity.manifestPath)
                        .map((reference) => `ProjectReference ${reference.include}`),
                ];
                found.push(explanation({
                    kind: 'binding-load-evidence',
                    confidence: declared.length > 0 ? 'declared' : 'none',
                    files: [stepPath, candidateFile],
                    projectIds: [featureProjectId, candidateProjectId],
                    relations: cites(input.ownership, [stepPath, candidateFile]),
                    provenance,
                    missing: [RUNTIME_MISSING, 'A matching assembly name is not proof the runner loaded that assembly.'],
                    detail: loadDetail(declared.length > 0, referenced, nameMatch),
                    layers: layers({
                        textualMatch: true,
                        fileOwnership: true,
                        potentialCompile: hasCompileEvidence(ownershipOf(input.ownership, candidateFile)),
                        loadConfiguration: true,
                    }),
                    nameMatch,
                }));
            }
        }
    }
    return found;
}

function loadDetail(hasDeclaration: boolean, referenced: boolean, nameMatch: AssemblyNameMatch): string {
    const reference = referenced
        ? ' A ProjectReference is compile evidence and is not bindingAssemblies.'
        : '';
    if (!hasDeclaration) {
        return `No bindingAssemblies entry was declared.${reference} Runtime load was not established.`;
    }
    if (nameMatch === 'derived-file-name') {
        return `bindingAssemblies names a string equal to the derived project file name. That equality is not load proof.${reference}`;
    }
    if (nameMatch === 'explicit-assembly-name') {
        return `bindingAssemblies matches an explicit AssemblyName. That is still not runtime accessibility.${reference}`;
    }
    return `bindingAssemblies is declared and does not establish that this candidate is loaded.${reference} Absence of a matching name is not proof the runner cannot see it.`;
}

function projectExplanation(
    kind: 'same-project-overlap' | 'cross-project-candidates',
    input: DiagnosisInput,
    files: readonly string[],
    projectIds: readonly string[],
    detail: string,
    flags: { textualMatch: boolean; fileOwnership: boolean; potentialCompile: boolean }
): DiagnosisExplanation {
    const relations = cites(input.ownership, files).filter((relation) =>
        projectIds.includes(relation.projectId)
        && (COMPILE_KINDS.has(relation.kind) || relation.kind === 'feature-candidate' || relation.kind === 'directory-containment'));
    const confidence = relations.some((relation) => relation.confidence === 'declared')
        ? 'declared'
        : relations.some((relation) => relation.confidence === 'convention')
            ? 'convention'
            : 'physical';
    return explanation({
        kind,
        confidence: confidence as DiagnosisConfidence,
        files,
        projectIds,
        relations,
        provenance: relations.map((relation) => `${relation.kind} ${relation.evidence}`),
        missing: [RUNTIME_MISSING, 'SDK default compile evidence is a convention, not an explicit Compile item, unless the relation says otherwise.'],
        detail,
        layers: layers(flags),
        nameMatch: 'none',
    });
}

function otherFrameworkPool(input: DiagnosisInput, candidateFiles: readonly string[]): string[] {
    const candidateExtension = candidateFiles.length > 0 ? path.extname(candidateFiles[0]) : '';
    if (!candidateExtension) {
        return [];
    }
    return unique((input.poolBindings ?? [])
        .map((binding) => pathKey(binding.uri.fsPath))
        .filter((file) => !candidateFiles.includes(file) && path.extname(file) !== candidateExtension));
}

function scopeNotSelected(input: DiagnosisInput, stepPath: string): readonly Binding[] {
    if (input.result.status !== 'unbound' || input.result.candidates.length > 0 || !input.poolBindings) {
        return [];
    }
    const text = input.result.step.rawText;
    return input.poolBindings.filter((binding) =>
        binding.scopeTags.length > 0
        && binding.patternRaw === text
        && pathKey(binding.uri.fsPath) !== stepPath);
}

function explanation(value: Omit<DiagnosisExplanation, 'runtimeConfirmed'>): DiagnosisExplanation {
    return { ...value, runtimeConfirmed: false };
}

function layers(flags: Partial<Omit<DiagnosisLayers, 'runtimeAccessibility'>>): DiagnosisLayers {
    return {
        textualMatch: flags.textualMatch ?? false,
        fileOwnership: flags.fileOwnership ?? false,
        potentialCompile: flags.potentialCompile ?? false,
        loadConfiguration: flags.loadConfiguration ?? false,
        runtimeAccessibility: false,
    };
}

function cites(report: FileOwnershipReport, files: readonly string[]): DiagnosisRelationCite[] {
    const cited: DiagnosisRelationCite[] = [];
    for (const file of files) {
        const owned = ownershipOf(report, file);
        if (!owned) {
            continue;
        }
        for (const relation of owned.relations) {
            cited.push(cite(file, relation));
        }
    }
    return cited;
}

function cite(file: string, relation: FileProjectRelation): DiagnosisRelationCite {
    return {
        file,
        projectId: relation.projectId,
        kind: relation.kind,
        confidence: relation.confidence,
        originPath: relation.originPath,
        evidence: relation.evidence,
    };
}

function ownershipOf(report: FileOwnershipReport, file: string): FileOwnership | undefined {
    const key = pathKey(file);
    return report.files.find((owned) => pathKey(owned.identity.path) === key);
}

function compileProjects(file: FileOwnership | undefined): string[] {
    if (!file) {
        return [];
    }
    return unique(file.relations.filter((relation) => COMPILE_KINDS.has(relation.kind)).map((relation) => relation.projectId));
}

function relatedProjects(file: FileOwnership | undefined): string[] {
    if (!file) {
        return [];
    }
    return unique(file.relations.map((relation) => relation.projectId));
}

function hasCompileEvidence(file: FileOwnership | undefined): boolean {
    return compileProjects(file).length > 0;
}

function intersection(sets: readonly (readonly string[])[]): string[] {
    if (sets.length === 0) {
        return [];
    }
    return sets[0].filter((value) => sets.every((set) => set.includes(value)));
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
}

function pathKey(file: string): string {
    return path.resolve(file);
}
