/**
 * Guardian ↔ BDD Pilot handoff helpers (suite glue — no test execution).
 */

import * as vscode from 'vscode';
import { t } from '../../i18n';

export const PILOT_EXTENSION_ID = 'anghelll.bdd-pilot';
export const PILOT_HANDOFF_COMMAND = 'bddPilot.showDashboard';

export type PilotHandoffAction = 'open' | 'install' | 'none';

export interface ResolvePilotHandoffInput {
    readonly handoffEnabled: boolean;
    readonly pilotInstalled: boolean;
}

/**
 * Pure: whether the Pilot extension id is among installed ids.
 */
export function isPilotExtensionIdPresent(
    idsPresent: readonly string[],
    pilotId: string = PILOT_EXTENSION_ID
): boolean {
    return idsPresent.includes(pilotId);
}

/**
 * Pure: which handoff CTA to show for unbound / toast contexts.
 * - open: Pilot installed → open dashboard
 * - install: Pilot missing → Marketplace search
 * - none: handoff disabled
 */
export function resolvePilotHandoffAction(input: ResolvePilotHandoffInput): PilotHandoffAction {
    if (!input.handoffEnabled) {
        return 'none';
    }
    return input.pilotInstalled ? 'open' : 'install';
}

export function isPilotHandoffEnabled(): boolean {
    return vscode.workspace
        .getConfiguration('bddGuardian.pilotHandoff')
        .get<boolean>('enabled', true);
}

export function isPilotExtensionInstalled(): boolean {
    return vscode.extensions.getExtension(PILOT_EXTENSION_ID) !== undefined;
}

/**
 * Activate Pilot (if needed) and open its dashboard.
 */
export async function openPilotDashboard(): Promise<boolean> {
    const ext = vscode.extensions.getExtension(PILOT_EXTENSION_ID);
    if (!ext) {
        return false;
    }
    try {
        if (!ext.isActive) {
            await ext.activate();
        }
        await vscode.commands.executeCommand(PILOT_HANDOFF_COMMAND);
        return true;
    } catch {
        return false;
    }
}

/**
 * Open Marketplace search for BDD Pilot.
 */
export async function openPilotMarketplaceSearch(): Promise<void> {
    await vscode.commands.executeCommand('workbench.extensions.search', PILOT_EXTENSION_ID);
}

/**
 * Open Pilot or show failure toast.
 */
export async function handoffOpenPilot(): Promise<void> {
    const ok = await openPilotDashboard();
    if (!ok) {
        void vscode.window.showWarningMessage(t('pilotHandoffFailed'));
    }
}

/**
 * Buttons for post-generate toast (reindex always; Pilot only if installed + enabled).
 */
export function resolvePostGenerateToastButtons(input: {
    handoffEnabled: boolean;
    pilotInstalled: boolean;
}): { showPilotRun: boolean } {
    return {
        showPilotRun:
            input.handoffEnabled && input.pilotInstalled,
    };
}
