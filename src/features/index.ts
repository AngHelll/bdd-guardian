/**
 * Features Module - Main exports for all feature providers
 */

// Navigation features
export {
    navigateToBinding,
    navigateToLocation,
    navigateFromResolveResult,
    peekLocation,
    showBindingQuickPick,
    showAllBindingsQuickPick,
    DefinitionProvider,
    createDefinitionProvider,
    CodeLensProvider,
    createCodeLensProvider,
    // Phase 2: Navigation History
    NavigationHistoryManager,
    getNavigationHistory,
    createNavigationHistoryCommands,
    createNavigationStatusBar,
} from './navigation';

// Diagnostics features
export {
    DiagnosticsEngine,
    DecorationsManager,
    type DiagnosticsResult,
    type DecorationStats,
} from './diagnostics';

// Hover features
export {
    HoverProvider,
    createHoverProvider,
} from './hovers';
