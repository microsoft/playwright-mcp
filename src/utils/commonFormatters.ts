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
 * Get performance indicator icon based on deviation or value/thresholds
 */
export function getPerformanceIcon(
  input:
    | { significance: 'significant' | 'notable' | 'minimal' | 'normal' }
    | { value: number; thresholds: { good: number; warning: number } }
): string {
  if ('significance' in input) {
    switch (input.significance) {
      case 'significant':
        return '🔴';
      case 'notable':
        return '🟡';
      default:
        return '🟢';
    }
  }
  const { value, thresholds } = input;
  if (value <= thresholds.good) {
    return '🟢';
  }
  if (value <= thresholds.warning) {
    return '🟡';
  }
  return '🔴';
}

/**
 * Get impact icon for configurations (supports both string and typed versions)
 */
export function getImpactIcon(impact: string): string {
  switch (impact) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪'; // neutral icon for unknown values
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
 * Build section with header and content (supports both formats)
 */
export function buildSection(
  title: string,
  content: string[],
  level = 2,
  options: { emptyLineAfter?: boolean; emptyLineBefore?: boolean } = {}
): string[] {
  const { emptyLineAfter = false, emptyLineBefore = true } = options;
  const prefix = '#'.repeat(level);
  const result: string[] = [];

  if (emptyLineBefore) {
    result.push('');
  }
  result.push(`${prefix} ${title}`, ...content);
  if (emptyLineAfter) {
    result.push('');
  }

  return result;
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

/**
 * Common code generation patterns for response.addCode()
 */

/**
 * Generate mouse movement code (common in mouse tools)
 */
export function generateMouseMoveCode(x: number, y: number): string {
  return `await page.mouse.move(${x}, ${y});`;
}

/**
 * Generate mouse click code (common in mouse tools)
 */
export function generateMouseClickCode(): string[] {
  return ['await page.mouse.down();', 'await page.mouse.up();'];
}

/**
 * Generate mouse drag code sequence
 */
export function generateMouseDragCode(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string[] {
  return [
    `// Drag mouse from (${startX}, ${startY}) to (${endX}, ${endY})`,
    generateMouseMoveCode(startX, startY),
    'await page.mouse.down();',
    generateMouseMoveCode(endX, endY),
    'await page.mouse.up();',
  ];
}

/**
 * Generate navigation code (common pattern)
 */
export function generateNavigationCode(url: string): string {
  return `await page.goto('${url}');`;
}

/**
 * Generate back/forward navigation code
 */
export function generateBackCode(): string {
  return 'await page.goBack();';
}

export function generateForwardCode(): string {
  return 'await page.goForward();';
}

/**
 * Generate keyboard press code
 */
export function generateKeyPressCode(key: string): string {
  return `await page.keyboard.press('${key}');`;
}

/**
 * Generate evaluation code
 */
export function generateEvaluationCode(functionCode: string): string {
  return `await page.evaluate(${quote(functionCode)});`;
}

/**
 * Generate locator-based evaluation code
 */
export function generateLocatorEvaluationCode(
  locator: string,
  functionCode: string
): string {
  return `await page.${locator}.evaluate(${quote(functionCode)});`;
}

/**
 * Simple quote utility for code generation
 */
function quote(str: string): string {
  return `'${str.replace(/'/g, "\\'")}'`;
}

/**
 * Common diagnostic and error handling utilities
 */

/**
 * Safe error message extraction (commonly duplicated pattern)
 * Unified function to replace various error handling patterns throughout the codebase
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Unknown error'
): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

/**
 * Create diagnostic error object with consistent structure
 */
export function createDiagnosticErrorInfo(
  error: unknown,
  operation = 'Unknown operation',
  component = 'Unknown component'
): { error: string; operation: string; component: string } {
  return {
    error: getErrorMessage(error),
    operation,
    component,
  };
}

/**
 * Handle resource disposal errors consistently
 */
export function handleResourceDisposalError(
  error: unknown,
  resourceType: string,
  logger: (message: string) => void = console.debug
): void {
  logger(`${resourceType} disposal failed: ${getErrorMessage(error)}`);
}

/**
 * Handle frame access errors consistently (common in frame reference management)
 */
export function handleFrameAccessError(
  error: unknown,
  frameInfo?: string
): { reason: string; frameInfo?: string } {
  return {
    reason: getErrorMessage(error, 'Access denied'),
    ...(frameInfo && { frameInfo }),
  };
}
