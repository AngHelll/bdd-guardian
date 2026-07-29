/**
 * guardian-cli entry (compiled to out/cli/main.js). No vscode import.
 */

import * as path from 'path';
import { loadProject } from './loadProject';
import { buildDiscoverReport } from './discover';
import { buildAnalyzeReport, DEFAULT_MAX_ITEMS } from './analyze';
import { buildResolveStepReport } from './resolveStep';
import { buildCoachAnalyzeReport } from './coachAnalyze';

const COMMANDS = new Set(['discover', 'analyze', 'resolve-step', 'coach-analyze']);

export const USAGE = [
    'Usage:',
    '  npm run guardian -- discover <project-dir>',
    '  npm run guardian -- analyze <project-dir> [--max-items <n>]',
    '  npm run guardian -- resolve-step <project-dir> <feature-path> <line>',
    '  npm run guardian -- coach-analyze <project-dir> [--feature <path>] [--max-items <n>]',
    '',
    'Exit codes: 0 ok · 1 error · 2 usage',
    'MCP: npm run guardian:mcp  (stdio — see docs/CLI.md)',
].join('\n');

export function usageError(message?: string): number {
    if (message) {
        console.error(message);
    }
    console.error(USAGE);
    return 2;
}

export function runCli(argv: string[]): number {
    const [command, ...rest] = argv;
    if (!command || command === '-h' || command === '--help') {
        return usageError();
    }

    if (!COMMANDS.has(command)) {
        return usageError(`unknown command: ${command}`);
    }

    let projectDir: string | undefined;
    let featurePath: string | undefined;
    let lineRaw: string | undefined;
    let maxItems = DEFAULT_MAX_ITEMS;
    const positional: string[] = [];

    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (arg === '--max-items') {
            const raw = rest[++i];
            const n = Number(raw);
            if (!raw || !Number.isFinite(n) || n < 1) {
                return usageError('invalid --max-items value');
            }
            maxItems = Math.floor(n);
            continue;
        }
        if (arg === '--feature') {
            const raw = rest[++i];
            if (!raw) {
                return usageError('missing --feature value');
            }
            featurePath = raw;
            continue;
        }
        if (arg.startsWith('-')) {
            return usageError(`unknown option: ${arg}`);
        }
        positional.push(arg);
    }

    if (command === 'resolve-step') {
        if (positional.length !== 3) {
            return usageError('resolve-step requires <project-dir> <feature-path> <line>');
        }
        projectDir = positional[0];
        featurePath = positional[1];
        lineRaw = positional[2];
    } else {
        if (positional.length !== 1) {
            return usageError(
                positional.length === 0 ? 'missing <project-dir>' : 'unexpected extra argument'
            );
        }
        projectDir = positional[0];
    }

    const resolved = path.resolve(projectDir!);

    try {
        const project = loadProject(resolved);

        if (command === 'discover') {
            console.log(JSON.stringify(buildDiscoverReport(project), null, 2));
            return 0;
        }
        if (command === 'analyze') {
            console.log(JSON.stringify(buildAnalyzeReport(project, { maxItems }), null, 2));
            return 0;
        }
        if (command === 'resolve-step') {
            const line = Number(lineRaw);
            if (!Number.isInteger(line) || line < 0) {
                return usageError('line must be a non-negative integer (0-based)');
            }
            console.log(
                JSON.stringify(buildResolveStepReport(project, featurePath!, line), null, 2)
            );
            return 0;
        }
        // coach-analyze
        console.log(
            JSON.stringify(
                buildCoachAnalyzeReport(project, { maxItems, featurePath }),
                null,
                2
            )
        );
        return 0;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`error: ${message}`);
        return 1;
    }
}
