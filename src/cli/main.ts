/**
 * guardian-cli entry (compiled to out/cli/main.js). No vscode import.
 */

import * as path from 'path';
import { loadProject } from './loadProject';
import { buildDiscoverReport } from './discover';
import { buildAnalyzeReport, DEFAULT_MAX_ITEMS } from './analyze';

export const USAGE = [
    'Usage:',
    '  npm run guardian -- discover <project-dir>',
    '  npm run guardian -- analyze <project-dir> [--max-items <n>]',
    '',
    'Exit codes: 0 ok · 1 error · 2 usage',
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

    if (command !== 'discover' && command !== 'analyze') {
        return usageError(`unknown command: ${command}`);
    }

    let projectDir: string | undefined;
    let maxItems = DEFAULT_MAX_ITEMS;

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
        if (arg.startsWith('-')) {
            return usageError(`unknown option: ${arg}`);
        }
        if (projectDir) {
            return usageError('unexpected extra argument');
        }
        projectDir = arg;
    }

    if (!projectDir) {
        return usageError('missing <project-dir>');
    }

    const resolved = path.resolve(projectDir);

    try {
        const project = loadProject(resolved);
        if (command === 'discover') {
            console.log(JSON.stringify(buildDiscoverReport(project), null, 2));
            return 0;
        }
        console.log(JSON.stringify(buildAnalyzeReport(project, { maxItems }), null, 2));
        return 0;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`error: ${message}`);
        return 1;
    }
}
