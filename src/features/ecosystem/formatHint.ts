/**
 * One-time suggestion of BDD Gherkin Format (presentation companion — no second indexer).
 */

import * as vscode from 'vscode';
import { t } from '../../i18n';

export const FORMAT_EXTENSION_ID = 'anghelll.bdd-gherkin-format';
export const FORMAT_HINT_DISMISSED_KEY = 'bddGuardian.ecosystem.formatHintShown';

/** Extensions that already format `.feature` files; suggesting Format next to them adds noise. */
export const OTHER_GHERKIN_FORMATTERS: readonly string[] = [
    'cucumberopen.cucumber-official',
    'alexkrechik.cucumberautocomplete',
];

export interface FormatHintInput {
    readonly hintEnabled: boolean;
    readonly alreadyShown: boolean;
    readonly installedIds: readonly string[];
}

/**
 * Pure: show the hint only once, only when no Gherkin formatter is installed.
 */
export function shouldShowFormatHint(input: FormatHintInput): boolean {
    if (!input.hintEnabled || input.alreadyShown) {
        return false;
    }
    const ids = new Set(input.installedIds.map((id) => id.toLowerCase()));
    if (ids.has(FORMAT_EXTENSION_ID)) {
        return false;
    }
    return !OTHER_GHERKIN_FORMATTERS.some((id) => ids.has(id));
}

export async function openFormatMarketplaceSearch(): Promise<void> {
    await vscode.commands.executeCommand('workbench.extensions.search', FORMAT_EXTENSION_ID);
}

async function showFormatHintIfNeeded(context: vscode.ExtensionContext): Promise<void> {
    const show = shouldShowFormatHint({
        hintEnabled: vscode.workspace
            .getConfiguration('bddGuardian.formatHint')
            .get<boolean>('enabled', true),
        alreadyShown: context.globalState.get<boolean>(FORMAT_HINT_DISMISSED_KEY, false),
        installedIds: vscode.extensions.all.map((ext) => ext.id),
    });
    if (!show) {
        return;
    }
    await context.globalState.update(FORMAT_HINT_DISMISSED_KEY, true);
    const selection = await vscode.window.showInformationMessage(
        t('formatHintMessage'),
        t('formatHintInstall'),
        t('onboardingDismiss')
    );
    if (selection === t('formatHintInstall')) {
        await openFormatMarketplaceSearch();
    }
}

/**
 * Waits for the first `.feature` editor, then offers Format once per machine.
 */
export function registerFormatHint(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('bddGuardian.format.install', openFormatMarketplaceSearch)
    );
    if (context.globalState.get<boolean>(FORMAT_HINT_DISMISSED_KEY, false)) {
        return;
    }
    const isFeature = (editor: vscode.TextEditor | undefined): boolean =>
        editor?.document.uri.path.endsWith('.feature') ?? false;

    if (isFeature(vscode.window.activeTextEditor)) {
        void showFormatHintIfNeeded(context);
        return;
    }
    const listener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (isFeature(editor)) {
            listener.dispose();
            void showFormatHintIfNeeded(context);
        }
    });
    context.subscriptions.push(listener);
}
