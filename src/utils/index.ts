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
} from './arrayUtils.js';

// Code deduplication utilities
export {
  ArrayBuilder,
  joinWithNewlines,
  SectionBuilder,
} from './codeDeduplicationUtils.js';
// Error handling and formatting utilities
export {
  formatConfidence,
  formatDiagnosticPair,
  formatExecutionTime,
  getErrorMessage,
  handleResourceDisposalError,
} from './commonFormatters.js';

// Resource management
export { createDisposableManager } from './disposableManager.js';

// Tool patterns
export {
  applyCommonExpectation,
  handleToolOperation,
} from './toolPatterns.js';
