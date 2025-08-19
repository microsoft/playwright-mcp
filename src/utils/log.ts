import debug from 'debug';

// Diagnostics module debug instances
export const elementDiscoveryDebug = debug(
  'pw:mcp:diagnostics:element-discovery'
);
export const frameReferenceDebug = debug('pw:mcp:diagnostics:frame-reference');
export const resourceDebug = debug('pw:mcp:diagnostics:resource');
export const smartConfigDebug = debug('pw:mcp:diagnostics:smart-config');
export const smartHandleDebug = debug('pw:mcp:diagnostics:smart-handle');
export const commonFormattersDebug = debug('pw:mcp:utils:common-formatters');

// Browser context debug instances
export const browserContextDebug = debug('pw:mcp:browser-context');
export const browserContextFactoryDebug = debug(
  'pw:mcp:browser-context-factory'
);
export const browserServerBackendDebug = debug('pw:mcp:browser-server-backend');

// Browser debug instance (for browser-context-factory)
export const browserDebug = debug('pw:mcp:browser');

// Test debug instance
export const testDebug = debug('pw:mcp:test');

// Context debug instance
export const contextDebug = debug('pw:mcp:context');

// MCP module debug instances
export const mcpServerDebug = debug('pw:mcp:server');
export const mcpTransportDebug = debug('pw:mcp:transport');

// Extension module debug instances
export const extensionContextDebug = debug('pw:mcp:extension:context');
export const extensionContextFactoryDebug = debug(
  'pw:mcp:extension:context-factory'
);
export const cdpRelayDebug = debug('pw:mcp:extension:cdp-relay');

// Batch execution debug instances
export const batchExecutorDebug = debug('pw:mcp:batch:executor');

// Loop module debug instances
export const loopDebug = debug('pw:mcp:loop');
export const historyDebug = debug('pw:mcp:loop:history');
export const toolDebug = debug('pw:mcp:loop:tool');

// Tools module debug instances
export const toolsUtilsDebug = debug('pw:mcp:tools:utils');
export const diagnoseConfigHandlerDebug = debug(
  'pw:mcp:tools:diagnose:config-handler'
);

// Tab module debug instance
export const tabDebug = debug('pw:mcp:tab');

// Program debug instance
export const programDebug = debug('pw:mcp:program');

// Response module debug instance
export const responseDebug = debug('pw:mcp:response');

// Error handler debug instance
export const errorHandlerDebug = debug('pw:mcp:error-handler');

// Test server debug instance
export const testserverDebug = debug('pw:mcp:testserver');

// Tab module additional debug instances
export const snapshotDebug = debug('pw:mcp:tab:snapshot');

// Error enrichment debug instance
export const errorEnrichmentDebug = debug(
  'pw:mcp:diagnostics:error-enrichment'
);

// Error logging function
const errorsDebug = debug('pw:mcp:errors');
export function logUnhandledError(error: unknown) {
  errorsDebug(error);
}
