/**
 * Navigation Module Exports
 */

export { navigateToBinding, navigateToLocation, navigateFromResolveResult, peekLocation } from './navigator';
export { showBindingQuickPick, showAllBindingsQuickPick } from './quickPick';
export { DefinitionProvider, createDefinitionProvider } from './definitionProvider';
export { CodeLensProvider, createCodeLensProvider } from './codelensProvider';

// Phase 2: Navigation History
export {
    NavigationHistoryManager,
    NavigationLocation,
    getNavigationHistory,
    createNavigationHistoryCommands,
    createNavigationStatusBar,
} from './navigationHistory';
