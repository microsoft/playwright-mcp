/**
 * Utilities to reduce common code duplication patterns
 */

/**
 * Format performance metrics with icons and thresholds
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
 * Format diagnostic key-value pairs
 */
export function formatDiagnosticKeyValue(
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
 * Format element counts with consistent styling
 */
export function formatElementCounts(counts: {
  total?: number;
  visible?: number;
  interactable?: number;
  disabled?: number;
}): string[] {
  const results: string[] = [];
  if (counts.total !== undefined) {
    results.push(formatDiagnosticKeyValue('Total elements', counts.total));
  }
  if (counts.visible !== undefined) {
    results.push(formatDiagnosticKeyValue('Visible elements', counts.visible));
  }
  if (counts.interactable !== undefined) {
    results.push(
      formatDiagnosticKeyValue('Interactable elements', counts.interactable)
    );
  }
  if (counts.disabled !== undefined) {
    results.push(
      formatDiagnosticKeyValue('Disabled elements', counts.disabled)
    );
  }
  return results;
}

/**
 * Create a section with header and content
 */
export function buildSection(
  title: string,
  content: string[],
  level = 2
): string[] {
  const prefix = '#'.repeat(level);
  return [`${prefix} ${title}`, ...content, ''];
}

/**
 * Format list items with consistent indentation
 */
export function formatListItems(items: string[], level = 0): string[] {
  const indent = '  '.repeat(level);
  return items.map((item) => `${indent}- ${item}`);
}

/**
 * Common array operations to reduce push() repetition
 */
export class ArrayBuilder<T> {
  private items: T[] = [];

  constructor(initial?: T[]) {
    if (initial) {
      this.items = [...initial];
    }
  }

  /**
   * Add single item
   */
  add(item: T): this {
    this.items.push(item);
    return this;
  }

  /**
   * Add multiple items
   */
  addAll(items: T[]): this {
    this.items.push(...items);
    return this;
  }

  /**
   * Add item conditionally
   */
  addIf(condition: boolean | (() => boolean), item: T | (() => T)): this {
    const shouldAdd = typeof condition === 'function' ? condition() : condition;
    if (shouldAdd) {
      const itemToAdd = typeof item === 'function' ? (item as () => T)() : item;
      this.items.push(itemToAdd);
    }
    return this;
  }

  /**
   * Add multiple items conditionally
   */
  addAllIf(
    condition: boolean | (() => boolean),
    items: T[] | (() => T[])
  ): this {
    const shouldAdd = typeof condition === 'function' ? condition() : condition;
    if (shouldAdd) {
      const itemsToAdd =
        typeof items === 'function' ? (items as () => T[])() : items;
      this.items.push(...itemsToAdd);
    }
    return this;
  }

  /**
   * Build final array
   */
  build(): T[] {
    return [...this.items];
  }

  /**
   * Get current items (for intermediate access)
   */
  getItems(): T[] {
    return [...this.items];
  }

  /**
   * Clear all items
   */
  clear(): this {
    this.items = [];
    return this;
  }
}

/**
 * Join array with newlines (most common pattern)
 */
export function joinLines(lines: string[]): string {
  return lines.join('\n');
}

// formatConfidence and formatExecutionTime moved to commonFormatters.ts to avoid duplication

/**
 * Truncate text at word boundaries
 */
export function truncateAtWordBoundary(
  text: string,
  maxLength: number
): string {
  if (text.length <= maxLength) {
    return text;
  }

  let truncateIndex = maxLength;
  if (text[maxLength] && text[maxLength] !== ' ' && text[maxLength] !== '\n') {
    for (let i = maxLength - 1; i >= 0; i--) {
      if (text[i] === ' ' || text[i] === '\n') {
        truncateIndex = i;
        break;
      }
    }
    if (maxLength - truncateIndex > 20) {
      truncateIndex = maxLength;
    }
  }

  return text.substring(0, truncateIndex).trim();
}

/**
 * Format error message with suggestions
 */
export function formatError(error: {
  message: string;
  suggestions?: string[];
}): string[] {
  const result = [`Error: ${error.message}`];
  if (error.suggestions && error.suggestions.length > 0) {
    result.push('', 'Suggestions:');
    result.push(...error.suggestions.map((s) => `- ${s}`));
  }
  return result;
}

/**
 * Get status icon for consistent status representation
 */
export function getStatusIcon(
  status: 'success' | 'warning' | 'error' | 'info'
): string {
  switch (status) {
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '🚨';
    case 'info':
      return 'ℹ️';
    default:
      return '⚪';
  }
}

/**
 * Get performance icon based on value and thresholds
 */
export function getPerformanceIcon(
  value: number,
  thresholds: { good: number; warning: number }
): string {
  if (value <= thresholds.good) {
    return '🟢';
  }
  if (value <= thresholds.warning) {
    return '🟡';
  }
  return '🔴';
}

/**
 * Get impact icon based on impact level
 */
export function getImpactIcon(impact: 'low' | 'medium' | 'high'): string {
  switch (impact) {
    case 'low':
      return '🟢';
    case 'medium':
      return '🟡';
    case 'high':
      return '🔴';
    default:
      return '⚪';
  }
}
