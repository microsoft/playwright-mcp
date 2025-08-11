/**
 * Common constants to reduce duplication across the codebase
 */

/**
 * Timeout values (in milliseconds)
 */
export const TIMEOUTS = {
  // Page operations
  DEFAULT_PAGE_TIMEOUT: 5000,
  LOAD_STATE_TIMEOUT: 5000,
  NETWORK_IDLE_TIMEOUT: 2000,
  STABILITY_TIMEOUT: 3000,
  RETRY_DELAY: 500,

  // Tool operations
  ELEMENT_DISCOVERY_TIMEOUT: 500,
  PAGE_ANALYSIS_TIMEOUT: 1000,
  PARALLEL_ANALYSIS_TIMEOUT: 2000,
  WAIT_FOR_COMPLETION: 1000,
  STABILITY_WAIT: 1500,

  // System operations
  PING_TIMEOUT: 5000,
  HEARTBEAT_INTERVAL: 3000,
  SESSION_LOG_FLUSH: 1000,
  FRAME_ACCESS_TIMEOUT: 1000,
  INITIALIZATION_TIMEOUT: 5000,

  // Wait operations
  MAX_WAIT_TIME: 30_000,
  SHORT_DELAY: 500,
  MEDIUM_DELAY: 1000,
  LONG_DELAY: 3000,
} as const;

/**
 * Performance and analysis thresholds
 */
export const THRESHOLDS = {
  // Performance
  HIGH_PERFORMANCE_IMPACT: 1000, // ms
  EXECUTION_TIME_WARNING: 2000, // ms
  EXECUTION_TIME_SLOW: 5000, // ms

  // Element counts
  LARGE_SUBTREE_ELEMENTS: 1000,
  SMALL_SUBTREE_ELEMENTS: 500,
  ELEMENTS_WARNING: 1500,
  ELEMENTS_DANGER: 3000,
  VISIBLE_ELEMENTS_LIMIT: 1000,
  DESCENDANT_COUNT_WARNING: 500,

  // Layout and styling
  HIGH_Z_INDEX: 1000,
  EXCESSIVE_Z_INDEX: 1000,

  // Image sizes (estimated KB)
  LARGE_IMAGE_SIZE: 1000,
  MEDIUM_IMAGE_SIZE: 500,

  // Performance metrics
  PERFORMANCE_TRACKER_HISTORY_SIZE: 1000,
  COMPLEXITY_HIGH: 2000,
  COMPLEXITY_MEDIUM: 1000,
} as const;

/**
 * Time durations (in milliseconds) for cleanup and tracking
 */
export const DURATIONS = {
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

/**
 * String manipulation constants
 */
export const STRING_LIMITS = {
  CDP_MESSAGE_PREVIEW: 500,
  DEFAULT_TRUNCATION: 1000,
} as const;

/**
 * WebSocket close codes and network constants
 */
export const NETWORK = {
  WS_NORMAL_CLOSURE: 1000,
} as const;

// Type exports for better TypeScript support
export type TimeoutKeys = keyof typeof TIMEOUTS;
export type ThresholdKeys = keyof typeof THRESHOLDS;
export type DurationKeys = keyof typeof DURATIONS;
