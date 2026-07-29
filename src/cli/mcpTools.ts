/**
 * MCP tool dispatch — pure mapping onto CLI report builders (no matching reimplementation).
 */

import { loadProject } from './loadProject';
import { buildDiscoverReport } from './discover';
import { buildAnalyzeReport, DEFAULT_MAX_ITEMS } from './analyze';
import { buildResolveStepReport } from './resolveStep';
import { buildCoachAnalyzeReport } from './coachAnalyze';

export const MCP_TOOL_NAMES = [
    'guardian_discover',
    'guardian_analyze',
    'guardian_resolve_step',
    'guardian_coach_analyze',
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export interface McpToolDescriptor {
    name: McpToolName;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export const MCP_TOOL_DESCRIPTORS: McpToolDescriptor[] = [
    {
        name: 'guardian_discover',
        description: 'Inventory .feature files and bindings in a project (JSON discover report).',
        inputSchema: {
            type: 'object',
            properties: {
                projectDir: { type: 'string', description: 'Absolute or relative project root' },
            },
            required: ['projectDir'],
        },
    },
    {
        name: 'guardian_analyze',
        description: 'Analyze bound/unbound/ambiguous/orphan map counts for a project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectDir: { type: 'string' },
                maxItems: { type: 'number', description: 'Cap detail lists (default 50)' },
            },
            required: ['projectDir'],
        },
    },
    {
        name: 'guardian_resolve_step',
        description: 'Resolve one Gherkin step (0-based line) to bound/unbound/ambiguous/no_step.',
        inputSchema: {
            type: 'object',
            properties: {
                projectDir: { type: 'string' },
                featurePath: { type: 'string' },
                line: { type: 'number', description: '0-based line number' },
            },
            required: ['projectDir', 'featurePath', 'line'],
        },
    },
    {
        name: 'guardian_coach_analyze',
        description: 'Run Coach quality rules on .feature files (read-only findings JSON).',
        inputSchema: {
            type: 'object',
            properties: {
                projectDir: { type: 'string' },
                featurePath: { type: 'string', description: 'Optional single feature path' },
                maxItems: { type: 'number' },
            },
            required: ['projectDir'],
        },
    },
];

function asString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`missing or invalid ${field}`);
    }
    return value;
}

function asOptionalNumber(value: unknown, field: string): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new Error(`invalid ${field}`);
    }
    return n;
}

/**
 * Run one MCP tool by name; returns a JSON-serializable report object.
 */
export function dispatchMcpTool(name: string, args: Record<string, unknown> = {}): unknown {
    if (!MCP_TOOL_NAMES.includes(name as McpToolName)) {
        throw new Error(`unknown tool: ${name}`);
    }

    const projectDir = asString(args.projectDir, 'projectDir');
    const project = loadProject(projectDir);

    switch (name as McpToolName) {
        case 'guardian_discover':
            return buildDiscoverReport(project);
        case 'guardian_analyze': {
            const maxItems = asOptionalNumber(args.maxItems, 'maxItems') ?? DEFAULT_MAX_ITEMS;
            return buildAnalyzeReport(project, { maxItems });
        }
        case 'guardian_resolve_step': {
            const featurePath = asString(args.featurePath, 'featurePath');
            const line = asOptionalNumber(args.line, 'line');
            if (line === undefined || !Number.isInteger(line)) {
                throw new Error('line must be an integer (0-based)');
            }
            return buildResolveStepReport(project, featurePath, line);
        }
        case 'guardian_coach_analyze': {
            const maxItems = asOptionalNumber(args.maxItems, 'maxItems') ?? DEFAULT_MAX_ITEMS;
            const featurePath =
                args.featurePath === undefined || args.featurePath === null
                    ? undefined
                    : asString(args.featurePath, 'featurePath');
            return buildCoachAnalyzeReport(project, { maxItems, featurePath });
        }
        default:
            throw new Error(`unknown tool: ${name}`);
    }
}
