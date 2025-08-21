// import debug from 'debug';

// No-op function to replace debug calls
const noop = (..._args: unknown[]) => {
  // Intentionally empty - replaces debug calls
};

// Diagnostics module debug instances
export const elementDiscoveryDebug = noop;
export const frameReferenceDebug = noop;
export const resourceDebug = noop;
export const smartConfigDebug = noop;
export const smartHandleDebug = noop;
export const commonFormattersDebug = noop;

// Browser context debug instances
export const browserContextDebug = noop;
export const browserContextFactoryDebug = noop;
export const browserServerBackendDebug = noop;

// Browser debug instance (for browser-context-factory)
export const browserDebug = noop;

// Test debug instance
export const testDebug = noop;

// Context debug instance
export const contextDebug = noop;

// MCP module debug instances
export const mcpServerDebug = noop;
export const mcpTransportDebug = noop;

// Extension module debug instances
export const extensionContextDebug = noop;
export const extensionContextFactoryDebug = noop;
export const cdpRelayDebug = noop;

// Batch execution debug instances
export const batchExecutorDebug = noop;

// Loop module debug instances
export const loopDebug = noop;
export const historyDebug = noop;
export const toolDebug = noop;

// Tools module debug instances
export const toolsUtilsDebug = noop;
export const diagnoseConfigHandlerDebug = noop;

// Tab module debug instance
export const tabDebug = noop;

// Program debug instance
export const programDebug = noop;

// Response module debug instance
export const responseDebug = noop;

// Error handler debug instance
export const errorHandlerDebug = noop;

// Test server debug instance
export const testserverDebug = noop;

// Tab module additional debug instances
export const snapshotDebug = noop;

// Error enrichment debug instance
export const errorEnrichmentDebug = noop;

// Error logging function
export function logUnhandledError(_error: unknown) {
  // noop for now
}
