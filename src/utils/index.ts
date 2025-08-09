/**
 * Central utilities index to reduce import duplication
 * Re-exports commonly used utilities from various modules
 */

// Diagnostic utilities
export { createDiagnosticLogger } from '../diagnostics/common/diagnostic-base.js';

// Array manipulation utilities
export {
  deduplicate,
  deduplicateAndLimit,
  filterTruthy,
  joinFiltered,
  limitItems,
} from './array-utils.js';

// Code deduplication utilities
export {
  ArrayBuilder,
  formatDiagnosticKeyValue,
  formatElementCounts,
  formatError,
  formatListItems,
  getStatusIcon,
  joinLines,
  truncateAtWordBoundary,
} from './code-deduplication-utils.js';
// Error handling and formatting utilities
export {
  formatConfidence,
  formatDiagnosticPair,
  formatExecutionTime,
  getErrorMessage,
  handleResourceDisposalError,
} from './common-formatters.js';

// Resource management
export { createDisposableManager } from './disposable-manager.js';

// Tool patterns
export {
  addMouseOperationComment,
  addNavigationComment,
  addOperationComment,
  addToolErrorContext,
  applyCommonExpectations,
  executeToolOperation,
  resolveElementLocator,
  setupToolResponse,
  ToolPatterns,
  validateAndResolveElement,
  validateElementParams,
  waitForToolCompletion,
} from './tool-patterns.js';
