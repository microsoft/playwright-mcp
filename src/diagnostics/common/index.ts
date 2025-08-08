// @ts-nocheck
/**
 * Common diagnostic utilities and base classes
 *
 * This module provides shared functionality for all diagnostic components:
 * - Base classes for consistent initialization and disposal patterns
 * - Performance tracking and metrics collection
 * - Error enrichment utilities and common patterns
 * - Initialization management with dependency resolution
 * - Centralized logging with consistent formatting
 */

export {
  createDiagnosticLogger,
  DiagnosticBase,
  diagnosticError,
  diagnosticInfo,
  diagnosticWarn,
  type IDisposable,
} from './diagnostic-base.js';
export {
  analyzeErrorPatterns,
  createEnrichedError,
  type EnrichmentResult,
  type ErrorContext,
  generateRecoverySuggestions,
  generateSuggestions,
  safeDispose,
  safeDisposeAll,
} from './error-enrichment-utils.js';
export {
  createAdvancedStage,
  createCoreStage,
  createDependentStage,
  type DisposableComponent,
  type InitializationContext,
  InitializationManager,
  type InitializationStage,
} from './initialization-manager.js';
export {
  globalPerformanceTracker,
  type PerformanceMetric,
  type PerformanceStats,
  PerformanceTracker,
} from './performance-tracker.js';
