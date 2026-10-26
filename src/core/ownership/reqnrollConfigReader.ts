/**
 * Reads Reqnroll's bindingAssemblies list from reqnroll.json.
 * A missing file, an invalid file, and an empty list are different results.
 */

import { stripBom } from './xmlLite';
import type { BindingAssemblyEvidence, ReqnrollConfigRead, StaticValue } from './types';

export interface ReqnrollConfigInput {
    readonly text: string | null;
    readonly configPath: string | null;
}

export function readReqnrollConfig(input: ReqnrollConfigInput): ReqnrollConfigRead {
    if (input.text === null) {
        return {
            status: 'absent',
            configPath: input.configPath,
            bindingAssemblies: [],
            formatError: null,
        };
    }
    if (!input.configPath) {
        return invalid(null, 'reqnroll.json path is missing');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(stripBom(input.text));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'JSON parse failed';
        return invalid(input.configPath, message);
    }
    if (!isRecord(parsed)) {
        return invalid(input.configPath, 'reqnroll.json root is not an object');
    }
    if (!Object.prototype.hasOwnProperty.call(parsed, 'bindingAssemblies')) {
        return present(input.configPath, []);
    }
    const entries = parsed.bindingAssemblies;
    if (!Array.isArray(entries)) {
        return invalid(input.configPath, 'bindingAssemblies is not an array');
    }

    const bindingAssemblies = entries.map((entry, index) =>
        readEntry(entry, input.configPath as string, index)
    );
    return present(input.configPath, bindingAssemblies);
}

function readEntry(entry: unknown, configPath: string, index: number): BindingAssemblyEvidence {
    if (isRecord(entry) && typeof entry.assembly === 'string') {
        const raw = entry.assembly;
        const name = raw.trim();
        if (name.length > 0) {
            return {
                kind: 'binding-load',
                assemblyName: {
                    status: 'resolved',
                    value: name,
                    raw,
                    source: 'reqnroll-json',
                    detail: null,
                },
                configPath,
                source: 'reqnroll-json',
            };
        }
    }
    return {
        kind: 'binding-load',
        assemblyName: unknownName(
            `bindingAssemblies[${index}] has no assembly name`,
            safeRaw(entry)
        ),
        configPath,
        source: 'reqnroll-json',
    };
}

function unknownName(detail: string, raw: string | null): StaticValue<string> {
    return {
        status: 'unknown',
        value: null,
        raw,
        source: 'reqnroll-json',
        detail,
    };
}

function present(
    configPath: string,
    bindingAssemblies: readonly BindingAssemblyEvidence[]
): ReqnrollConfigRead {
    return {
        status: 'present',
        configPath,
        bindingAssemblies,
        formatError: null,
    };
}

function invalid(configPath: string | null, formatError: string): ReqnrollConfigRead {
    return {
        status: 'invalid',
        configPath,
        bindingAssemblies: [],
        formatError,
    };
}

function safeRaw(entry: unknown): string | null {
    try {
        return JSON.stringify(entry);
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
