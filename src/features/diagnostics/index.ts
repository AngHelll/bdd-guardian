/**
 * Diagnostics Module Exports
 */

export { DiagnosticsEngine, type DiagnosticsResult } from './diagnosticsEngine';
export { DecorationsManager, type DecorationStats } from './decorations';
export {
    OrphanBindingsDiagnostics,
    isOrphanBindingsEnabled,
} from './orphanBindingsDiagnostics';
export { 
    copyDebugReportToClipboard, 
    generateDebugReport, 
    recordIndexDuration, 
    recordResolveDuration,
    type DebugReport 
} from './debugReport';
