/**
 * Common report building utilities to reduce code duplication
 */

/**
 * Generic report builder for consistent text output generation
 */
export class TextReportBuilder {
  private readonly sections: string[] = [];

  constructor() {
    this.sections = [];
  }

  /**
   * Add a section header
   */
  addHeader(text: string, level = 2): this {
    const prefix = '#'.repeat(level);
    this.sections.push(`${prefix} ${text}`);
    return this;
  }

  /**
   * Add a regular line of text
   */
  addLine(text: string): this {
    this.sections.push(text);
    return this;
  }

  /**
   * Add multiple lines at once
   */
  addLines(lines: string[]): this {
    this.sections.push(...lines);
    return this;
  }

  /**
   * Add a formatted list item
   */
  addListItem(text: string, level = 0): this {
    const indent = '  '.repeat(level);
    this.sections.push(`${indent}- ${text}`);
    return this;
  }

  /**
   * Add a formatted key-value item
   */
  addKeyValue(key: string, value: string | number, level = 0): this {
    const indent = '  '.repeat(level);
    this.sections.push(`${indent}- **${key}:** ${value}`);
    return this;
  }

  /**
   * Add an empty line
   */
  addEmptyLine(): this {
    this.sections.push('');
    return this;
  }

  /**
   * Add a code block
   */
  addCodeBlock(code: string, language = ''): this {
    this.sections.push(`\`\`\`${language}`);
    this.sections.push(code);
    this.sections.push('```');
    return this;
  }

  /**
   * Add conditional content
   */
  addIf(
    condition: boolean | (() => boolean),
    builder: (rb: TextReportBuilder) => void
  ): this {
    const shouldAdd = typeof condition === 'function' ? condition() : condition;
    if (shouldAdd) {
      builder(this);
    }
    return this;
  }

  /**
   * Add a section with automatic spacing
   */
  addSection(
    title: string,
    builder: (rb: TextReportBuilder) => void,
    level = 2
  ): this {
    this.addEmptyLine();
    this.addHeader(title, level);
    builder(this);
    return this;
  }

  /**
   * Build the final report string
   */
  build(): string {
    return this.sections.join('\n');
  }

  /**
   * Get current sections for debugging
   */
  getSections(): string[] {
    return [...this.sections];
  }

  /**
   * Clear all sections
   */
  clear(): this {
    this.sections = [];
    return this;
  }
}

/**
 * Performance metrics formatting utilities
 */
export class PerformanceReportBuilder extends TextReportBuilder {
  /**
   * Add a performance metric with optional threshold checking
   */
  addMetric(
    name: string,
    value: number,
    unit: string,
    threshold?: number,
    level = 0
  ): this {
    let text = `**${name}:** ${value}${unit}`;

    if (threshold && value > threshold) {
      text += ` ⚠️ (threshold: ${threshold}${unit})`;
    }

    this.addListItem(text, level);
    return this;
  }

  /**
   * Add timing metrics with automatic formatting
   */
  addTiming(
    name: string,
    timeMs: number,
    thresholdMs?: number,
    level = 0
  ): this {
    return this.addMetric(name, Math.round(timeMs), 'ms', thresholdMs, level);
  }

  /**
   * Add percentage metrics
   */
  addPercentage(name: string, value: number, level = 0): this {
    const percentage = Math.round(value * 100);
    this.addListItem(`**${name}:** ${percentage}%`, level);
    return this;
  }
}

/**
 * Diagnostic information formatting utilities
 */
export class DiagnosticReportBuilder extends TextReportBuilder {
  /**
   * Add diagnostic information with consistent formatting
   */
  addDiagnosticInfo(
    label: string,
    value: string | number | boolean,
    level = 0
  ): this {
    let formattedValue: string;

    if (typeof value === 'boolean') {
      formattedValue = value ? 'Yes' : 'No';
    } else if (typeof value === 'number') {
      formattedValue = value.toString();
    } else {
      formattedValue = value;
    }

    this.addKeyValue(label, formattedValue, level);
    return this;
  }

  /**
   * Add diagnostic section with error handling
   */
  addDiagnosticSection<T>(
    title: string,
    data: T | undefined,
    formatter: (item: T) => void,
    level = 2
  ): this {
    return this.addSection(
      title,
      (builder) => {
        if (data) {
          try {
            formatter(data);
          } catch (error) {
            builder.addListItem(
              `Error formatting diagnostic data: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        } else {
          builder.addListItem('No data available');
        }
      },
      level
    );
  }

  /**
   * Add element count information
   */
  addElementCounts(counts: {
    total?: number;
    visible?: number;
    interactable?: number;
    disabled?: number;
  }): this {
    if (counts.total !== undefined) {
      this.addDiagnosticInfo('Total elements', counts.total);
    }
    if (counts.visible !== undefined) {
      this.addDiagnosticInfo('Visible elements', counts.visible);
    }
    if (counts.interactable !== undefined) {
      this.addDiagnosticInfo('Interactable elements', counts.interactable);
    }
    if (counts.disabled !== undefined) {
      this.addDiagnosticInfo('Disabled elements', counts.disabled);
    }
    return this;
  }
}

/**
 * Format file sizes
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)}${units[unitIndex]}`;
}

// Use formatExecutionTime from commonFormatters to avoid duplication

// Re-export formatConfidence from commonFormatters to avoid duplication
export { formatConfidence as formatConfidencePercentage } from './commonFormatters.js';

/**
 * Generate performance indicator icons
 */
export function getPerformanceStatusIcon(
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
 * Generate status icons
 */
export function getReportStatusIcon(
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
