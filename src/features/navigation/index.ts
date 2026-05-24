/**
 * Navigation Module Exports
 */

export { navigateToBinding, navigateToLocation, navigateFromResolveResult, peekLocation } from './navigator';
export { showBindingQuickPick, showAllBindingsQuickPick } from './quickPick';
export { DefinitionProvider, createDefinitionProvider } from './definitionProvider';
export { CodeLensProvider, createCodeLensProvider } from './codelensProvider';
export { ReferenceProvider, createReferenceProvider } from './referenceProvider';
export {
    FEATURE_DOCUMENT_SELECTORS,
    BINDING_DOCUMENT_SELECTORS,
    REFERENCE_DOCUMENT_SELECTORS,
} from './documentSelectors';

// Phase 2: Navigation History
export {
    NavigationHistoryManager,
    NavigationLocation,
    getNavigationHistory,
    createNavigationHistoryCommands,
    createNavigationStatusBar,
} from './navigationHistory';
