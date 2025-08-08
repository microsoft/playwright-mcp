/**
 * Common formatting functions to reduce code duplication
 */

/**
 * Format performance metrics with consistent styling
 */
export function formatPerformanceMetric(
  name: string,
  value: number,
  unit: string,
  threshold?: number
): string {
  const icon = threshold && value > threshold ? '⚠️' : '✅';
  const thresholdText = threshold ? ` (threshold: ${threshold}${unit})` : '';
  return `${icon} **${name}**: ${value}${unit}${thresholdText}`;
}

/**
 * Format confidence as percentage (used in multiple places)
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Format execution time with appropriate units
 */
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get performance indicator icon based on deviation
 */
export function getPerformanceIcon(deviation: {
  significance: 'significant' | 'notable' | 'minimal' | 'normal';
}): string {
  switch (deviation.significance) {
    case 'significant':
      return '🔴';
    case 'notable':
      return '🟡';
    default:
      return '🟢';
  }
}

/**
 * Get impact icon for configurations
 */
export function getImpactIcon(impact: string): string {
  switch (impact) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    default:
      return '🟢';
  }
}

/**
 * Get recommendation type icon
 */
export function getRecommendationIcon(type: string): string {
  switch (type) {
    case 'warning':
      return '⚠️';
    case 'optimization':
      return '⚡';
    default:
      return 'ℹ️';
  }
}

/**
 * Format diagnostic key-value pair
 */
export function formatDiagnosticPair(
  key: string,
  value: string | number | boolean
): string {
  let formattedValue: string;
  if (typeof value === 'boolean') {
    formattedValue = value ? 'Yes' : 'No';
  } else {
    formattedValue = value.toString();
  }
  return `- **${key}:** ${formattedValue}`;
}

/**
 * Build section with header and content (common pattern)
 */
export function buildSection(
  title: string,
  content: string[],
  level = 2
): string[] {
  const prefix = '#'.repeat(level);
  return ['', `${prefix} ${title}`, ...content];
}

/**
 * Safe error message extraction (used in multiple catch blocks)
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Add items to array conditionally (reduces if/push pattern)
 */
export function addConditional<T>(
  array: T[],
  condition: boolean,
  items: T | T[]
): void {
  if (condition) {
    if (Array.isArray(items)) {
      array.push(...items);
    } else {
      array.push(items);
    }
  }
}
