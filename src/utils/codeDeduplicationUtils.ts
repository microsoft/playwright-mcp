/**
 * Utilities to reduce common code duplication patterns
 */

/**
 * Common patterns for building diagnostic reports
 */
export class ReportFormatter {
  /**
   * Format performance metrics with icons and thresholds
   */
  static formatPerformanceMetric(
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
  static formatDiagnosticKeyValue(
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
  static formatElementCounts(counts: {
    total?: number;
    visible?: number;
    interactable?: number;
    disabled?: number;
  }): string[] {
    const results: string[] = [];
    if (counts.total !== undefined) {
      results.push(
        ReportFormatter.formatDiagnosticKeyValue('Total elements', counts.total)
      );
    }
    if (counts.visible !== undefined) {
      results.push(
        ReportFormatter.formatDiagnosticKeyValue(
          'Visible elements',
          counts.visible
        )
      );
    }
    if (counts.interactable !== undefined) {
      results.push(
        ReportFormatter.formatDiagnosticKeyValue(
          'Interactable elements',
          counts.interactable
        )
      );
    }
    if (counts.disabled !== undefined) {
      results.push(
        ReportFormatter.formatDiagnosticKeyValue(
          'Disabled elements',
          counts.disabled
        )
      );
    }
    return results;
  }

  /**
   * Create a section with header and content
   */
  static buildSection(title: string, content: string[], level = 2): string[] {
    const prefix = '#'.repeat(level);
    return [`${prefix} ${title}`, ...content, ''];
  }

  /**
   * Format list items with consistent indentation
   */
  static formatListItems(items: string[], level = 0): string[] {
    const indent = '  '.repeat(level);
    return items.map((item) => `${indent}- ${item}`);
  }
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
 * Common string formatting utilities
 */
export class StringUtils {
  /**
   * Join array with newlines (most common pattern)
   */
  static joinLines(lines: string[]): string {
    return lines.join('\n');
  }

  /**
   * Format confidence as percentage
   */
  static formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Format execution time with appropriate units
   */
  static formatExecutionTime(ms: number): string {
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
   * Truncate text at word boundaries
   */
  static truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    let truncateIndex = maxLength;
    if (
      text[maxLength] &&
      text[maxLength] !== ' ' &&
      text[maxLength] !== '\n'
    ) {
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
}

/**
 * Common error handling patterns
 */
export class ErrorFormatting {
  /**
   * Format error message with suggestions
   */
  static formatError(error: {
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
   * Safe error message extraction
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

/**
 * Icon utilities for consistent status representation
 */
export class IconUtils {
  static getStatusIcon(
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

  static getPerformanceIcon(
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

  static getImpactIcon(impact: 'low' | 'medium' | 'high'): string {
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
}
