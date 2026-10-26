/**
 * Conservative static properties for AssemblyName and TargetFramework.
 *
 * Order, matching the SDK layout and GetPathOfFileAbove:
 * 1. The nearest Directory.Build.props, if it can be parsed.
 * 2. The project file, which overwrites those properties.
 * 3. The nearest Directory.Build.targets is recorded and not read.
 *    Any value it could overwrite stays unknown.
 *
 * Only unconditional literals are applied. A $(Name) reference expands
 * when Name is already a literal in that set. Conditions, functions,
 * item transforms, and Import graphs are not evaluated.
 */

import * as fs from 'fs';
import * as path from 'path';
import { attribute, localName, parseXmlDocument } from './xmlLite';
import type { XmlElement } from './xmlLite';
import type {
    AssemblyIdentity,
    EvaluatedImportEvidence,
    StaticValue,
    UnevaluatedImportEvidence,
} from './types';

export interface StaticPropertyResult {
    readonly assembly: AssemblyIdentity;
    readonly targetFrameworks: StaticValue<readonly string[]>;
    readonly evaluatedImports: readonly EvaluatedImportEvidence[];
    readonly unevaluatedImports: readonly UnevaluatedImportEvidence[];
}

interface LiteralCell {
    readonly kind: 'literal';
    readonly value: string;
    readonly raw: string;
    readonly originPath: string;
    readonly propertyName: string;
    readonly resolution: 'explicit' | 'inherited';
    readonly detail: string | null;
}

interface UncertainCell {
    readonly kind: 'unknown' | 'unresolved';
    readonly raw: string | null;
    readonly originPath: string | null;
    readonly propertyName: string;
    readonly source: 'csproj-property' | 'directory-build-props';
    readonly detail: string;
}

type Cell = LiteralCell | UncertainCell;

interface Bag {
    readonly cells: Map<string, Cell>;
    uncertainAbsence: boolean;
}

export function resolveStaticProperties(input: {
    readonly project: XmlElement | null;
    readonly manifestPath: string;
    readonly projectFileName: string;
    readonly scanRoot?: string;
}): StaticPropertyResult {
    const projectDir = path.dirname(input.manifestPath);
    const scanRoot = path.resolve(input.scanRoot ?? projectDir);
    const propsPath = nearestFile(projectDir, 'Directory.Build.props', scanRoot);
    const targetsPath = nearestFile(projectDir, 'Directory.Build.targets', scanRoot);
    const evaluatedImports: EvaluatedImportEvidence[] = [];
    const unevaluatedImports: UnevaluatedImportEvidence[] = [];
    const bag = emptyBag();

    if (!input.project) {
        bag.uncertainAbsence = true;
        if (propsPath) {
            unevaluatedImports.push(unread(propsPath, 'Directory.Build.props was not applied because the project file did not parse.'));
        }
        if (targetsPath) {
            unevaluatedImports.push(unread(targetsPath, 'Directory.Build.targets was found and not evaluated.'));
        }
        return finish(bag, input, evaluatedImports, unevaluatedImports, Boolean(targetsPath));
    }

    if (propsPath) {
        const text = readText(propsPath);
        const parsed = text === null
            ? { root: null, error: 'Directory.Build.props could not be read.' }
            : parseXmlDocument(text);
        if (parsed.error || !parsed.root || localName(parsed.root.name).toLowerCase() !== 'project') {
            bag.uncertainAbsence = true;
            unevaluatedImports.push(unread(
                propsPath,
                parsed.error ?? 'Directory.Build.props has no Project root and was not applied.'
            ));
        } else {
            walk(parsed.root, propsPath, 'inherited', bag, unevaluatedImports);
            evaluatedImports.push({
                kind: 'evaluated-import',
                path: propsPath,
                role: 'directory-build-props',
                status: 'resolved',
                source: 'directory-import',
                detail: 'Nearest Directory.Build.props. Unconditional literals were applied before the project file. A farther Directory.Build.props was not imported.',
            });
        }
    }

    walk(input.project, input.manifestPath, 'explicit', bag, unevaluatedImports);

    const targetsBlock = Boolean(targetsPath);
    if (targetsPath) {
        unevaluatedImports.push(unread(
            targetsPath,
            'Directory.Build.targets was found and not evaluated. It is imported after the project and can overwrite properties.'
        ));
        poison(bag, 'Directory.Build.targets was found and not evaluated. It can overwrite this property.');
    }

    return finish(bag, input, evaluatedImports, unevaluatedImports, targetsBlock);
}

function finish(
    bag: Bag,
    input: { readonly manifestPath: string; readonly projectFileName: string },
    evaluatedImports: readonly EvaluatedImportEvidence[],
    unevaluatedImports: readonly UnevaluatedImportEvidence[],
    targetsBlock: boolean
): StaticPropertyResult {
    return {
        assembly: { name: assemblyName(bag, input.manifestPath, input.projectFileName, targetsBlock) },
        targetFrameworks: targetFrameworks(bag),
        evaluatedImports,
        unevaluatedImports,
    };
}

function walk(
    project: XmlElement,
    originPath: string,
    resolution: 'explicit' | 'inherited',
    bag: Bag,
    unevaluatedImports: UnevaluatedImportEvidence[]
): void {
    for (const child of project.children) {
        const name = localName(child.name).toLowerCase();
        if (name === 'import') {
            const projectAttr = attribute(child, 'Project') ?? '';
            unevaluatedImports.push({
                kind: 'unevaluated-import',
                path: projectAttr || originPath,
                status: projectAttr.includes('$(') ? 'unresolved' : 'unknown',
                source: 'directory-import',
                detail: `Import "${projectAttr || '(missing Project)'}" in ${path.basename(originPath)} was not evaluated.`,
            });
            poison(bag, `Import "${projectAttr || '(missing Project)'}" was not evaluated and can overwrite properties.`);
            continue;
        }
        if (name === 'choose') {
            unevaluatedImports.push(unread(originPath, `Choose/When in ${path.basename(originPath)} was not evaluated.`));
            poison(bag, `Choose/When in ${path.basename(originPath)} was not evaluated and can overwrite properties.`);
            continue;
        }
        if (name !== 'propertygroup') {
            continue;
        }
        const groupConditional = attribute(child, 'Condition') !== undefined;
        for (const property of child.children) {
            assign(property, groupConditional, originPath, resolution, bag);
        }
    }
}

function assign(
    property: XmlElement,
    groupConditional: boolean,
    originPath: string,
    resolution: 'explicit' | 'inherited',
    bag: Bag
): void {
    const propertyName = localName(property.name);
    const key = propertyName.toLowerCase();
    const raw = property.text.trim();
    const source = resolution === 'inherited' ? 'directory-build-props' : 'csproj-property';
    if (groupConditional || attribute(property, 'Condition') !== undefined || property.children.length > 0) {
        bag.cells.set(key, {
            kind: 'unknown',
            raw: raw || null,
            originPath,
            propertyName,
            source,
            detail: `${propertyName} depends on an MSBuild condition that was not evaluated.`,
        });
        return;
    }
    if (raw.length === 0) {
        bag.cells.set(key, {
            kind: 'unknown',
            raw,
            originPath,
            propertyName,
            source,
            detail: `${propertyName} is empty.`,
        });
        return;
    }
    if (hasFunctionOrTransform(raw)) {
        bag.cells.set(key, {
            kind: 'unresolved',
            raw,
            originPath,
            propertyName,
            source,
            detail: `${propertyName} uses an MSBuild function or transform that was not evaluated.`,
        });
        return;
    }
    const expanded = expandLiteral(raw, bag);
    if (!expanded.ok) {
        bag.cells.set(key, {
            kind: 'unresolved',
            raw,
            originPath,
            propertyName,
            source,
            detail: expanded.detail,
        });
        return;
    }
    bag.cells.set(key, {
        kind: 'literal',
        value: expanded.value,
        raw,
        originPath,
        propertyName,
        resolution,
        detail: expanded.detail,
    });
}

function expandLiteral(
    raw: string,
    bag: Bag
): { ok: true; value: string; detail: string | null } | { ok: false; detail: string } {
    if (!raw.includes('$(')) {
        return { ok: true, value: raw, detail: null };
    }
    const used: string[] = [];
    let failure: string | null = null;
    const value = raw.replace(/\$\(([^)]*)\)/g, (whole, inner: string) => {
        const name = inner.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            failure = `${whole} is not a static property reference.`;
            return whole;
        }
        const cell = bag.cells.get(name.toLowerCase());
        if (!cell || cell.kind !== 'literal') {
            failure = `${whole} is not a literal property in the static set.`;
            return whole;
        }
        used.push(name);
        return cell.value;
    });
    if (failure || value.includes('$(')) {
        return { ok: false, detail: failure ?? 'A property reference was not expanded.' };
    }
    return {
        ok: true,
        value,
        detail: `Expanded ${used.map((name) => `$(${name})`).join(', ')} from a literal already in the static set.`,
    };
}

function assemblyName(
    bag: Bag,
    manifestPath: string,
    projectFileName: string,
    targetsBlock: boolean
): StaticValue<string> {
    const cell = bag.cells.get('assemblyname');
    if (!cell) {
        if (bag.uncertainAbsence || targetsBlock) {
            return {
                status: 'unknown',
                resolution: 'unknown',
                value: null,
                raw: null,
                source: 'absent',
                originPath: null,
                propertyName: 'AssemblyName',
                detail: 'AssemblyName is not declared in the static set. The file-name default was not applied because an unevaluated import or Directory.Build.targets may set it.',
            };
        }
        const fromFile = projectFileName.replace(/\.csproj$/i, '');
        return {
            status: 'inferred',
            resolution: 'derived',
            value: fromFile,
            raw: null,
            source: 'project-file-name',
            originPath: manifestPath,
            propertyName: 'AssemblyName',
            detail: 'AssemblyName is not declared. Derived from the project file name. The directory name was not used. This is not a runtime observation.',
        };
    }
    return fromCell(cell);
}

function targetFrameworks(bag: Bag): StaticValue<readonly string[]> {
    const single = bag.cells.get('targetframework');
    const multiple = bag.cells.get('targetframeworks');
    if (!single && !multiple) {
        const detail = bag.uncertainAbsence
            ? 'TargetFramework is not declared in the static set. An unevaluated import may set it. No target-framework default was invented.'
            : 'TargetFramework is not declared in the project file or in the nearest Directory.Build.props.';
        return {
            status: 'unknown',
            resolution: 'unknown',
            value: null,
            raw: null,
            source: 'absent',
            originPath: null,
            propertyName: 'TargetFramework',
            detail,
        };
    }
    if (single && multiple) {
        return {
            status: 'unknown',
            resolution: 'unknown',
            value: null,
            raw: [cellRaw(single), cellRaw(multiple)].filter((item): item is string => item !== null).join(' | '),
            source: cellSource(multiple),
            originPath: multiple.originPath ?? single.originPath,
            propertyName: 'TargetFrameworks',
            detail: 'Both TargetFramework and TargetFrameworks are declared. Which one applies was not evaluated.',
        };
    }
    const chosen = (single ?? multiple) as Cell;
    if (chosen.kind !== 'literal') {
        return {
            status: chosen.kind,
            resolution: chosen.kind,
            value: null,
            raw: chosen.raw,
            source: chosen.source,
            originPath: chosen.originPath,
            propertyName: chosen.propertyName,
            detail: chosen.detail,
        };
    }
    const parts = chosen.value.split(';').map((item) => item.trim()).filter((item) => item.length > 0);
    return {
        status: 'resolved',
        resolution: chosen.resolution,
        value: parts,
        raw: chosen.raw,
        source: chosen.resolution === 'inherited' ? 'directory-build-props' : 'csproj-property',
        originPath: chosen.originPath,
        propertyName: chosen.propertyName,
        detail: chosen.detail,
    };
}

function fromCell(cell: Cell): StaticValue<string> {
    if (cell.kind !== 'literal') {
        return {
            status: cell.kind,
            resolution: cell.kind,
            value: null,
            raw: cell.raw,
            source: cell.source,
            originPath: cell.originPath,
            propertyName: cell.propertyName,
            detail: cell.detail,
        };
    }
    return {
        status: 'resolved',
        resolution: cell.resolution,
        value: cell.value,
        raw: cell.raw,
        source: cell.resolution === 'inherited' ? 'directory-build-props' : 'csproj-property',
        originPath: cell.originPath,
        propertyName: cell.propertyName,
        detail: cell.detail,
    };
}

function poison(bag: Bag, detail: string): void {
    bag.uncertainAbsence = true;
    for (const [key, cell] of bag.cells) {
        if (cell.kind !== 'literal') {
            continue;
        }
        bag.cells.set(key, {
            kind: 'unknown',
            raw: cell.raw,
            originPath: cell.originPath,
            propertyName: cell.propertyName,
            source: cell.resolution === 'inherited' ? 'directory-build-props' : 'csproj-property',
            detail,
        });
    }
}

function emptyBag(): Bag {
    return { cells: new Map(), uncertainAbsence: false };
}

function hasFunctionOrTransform(raw: string): boolean {
    return raw.includes('$([') || raw.includes('%(') || raw.includes('@(');
}

function cellRaw(cell: Cell): string | null {
    return cell.raw;
}

function cellSource(cell: Cell): StaticValue<string>['source'] {
    if (cell.kind === 'literal') {
        return cell.resolution === 'inherited' ? 'directory-build-props' : 'csproj-property';
    }
    return cell.source;
}

function unread(filePath: string, detail: string): UnevaluatedImportEvidence {
    return {
        kind: 'unevaluated-import',
        path: filePath,
        status: 'unknown',
        source: 'directory-import',
        detail,
    };
}

function nearestFile(startDir: string, fileName: string, scanRoot: string): string | null {
    let dir = path.resolve(startDir);
    const root = path.resolve(scanRoot);
    if (!isInside(dir, root)) {
        return null;
    }
    while (isInside(dir, root)) {
        const candidate = path.join(dir, fileName);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
        if (dir === root) {
            break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return null;
}

function isInside(child: string, parent: string): boolean {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readText(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}
