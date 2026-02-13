/**
 * Diagnostics Module Exports
 */

export { DiagnosticsEngine, type DiagnosticsResult } from './diagnosticsEngine';
export { DecorationsManager, type DecorationStats } from './decorations';
export { 
    copyDebugReportToClipboard, 
    generateDebugReport, 
    recordIndexDuration, 
    recordResolveDuration,
    type DebugReport 
} from './debugReport';
