/**
 * Onboarding hint when workspace has features but zero indexed bindings.
 */

import * as vscode from 'vscode';
import { t } from '../../i18n';

export const ZERO_BINDINGS_DISMISSED_KEY = 'bddGuardian.onboarding.zeroBindingsDismissed';

export interface ZeroBindingsHintInput {
    bindingCount: number;
    featureCount: number;
    dismissed: boolean;
    onboardingEnabled: boolean;
    isIndexing: boolean;
}

/**
 * Pure trigger logic for unit tests.
 */
export function shouldShowZeroBindingsHint(input: ZeroBindingsHintInput): boolean {
    if (!input.onboardingEnabled || input.dismissed || input.isIndexing) {
        return false;
    }
    return input.bindingCount === 0 && input.featureCount > 0;
}

export async function showZeroBindingsHintIfNeeded(
    context: vscode.ExtensionContext,
    bindingCount: number,
    featureCount: number,
    isIndexing: boolean
): Promise<void> {
    const config = vscode.workspace.getConfiguration('bddGuardian.onboarding');
    const onboardingEnabled = config.get<boolean>('enabled', true);
    const dismissed = context.globalState.get<boolean>(ZERO_BINDINGS_DISMISSED_KEY, false);

    if (
        !shouldShowZeroBindingsHint({
            bindingCount,
            featureCount,
            dismissed,
            onboardingEnabled,
            isIndexing,
        })
    ) {
        return;
    }

    const selection = await vscode.window.showInformationMessage(
        t('onboardingZeroBindings'),
        t('onboardingShowProviderReport'),
        t('onboardingReindex'),
        t('onboardingDismiss')
    );

    if (selection === t('onboardingShowProviderReport')) {
        await vscode.commands.executeCommand('reqnroll-navigator.showProviderReport');
    } else if (selection === t('onboardingReindex')) {
        await vscode.commands.executeCommand('reqnrollNavigator.reindex');
    } else if (selection === t('onboardingDismiss')) {
        await context.globalState.update(ZERO_BINDINGS_DISMISSED_KEY, true);
    }
}
