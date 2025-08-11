/**
 * Utility to reduce repetitive section building patterns
 */

/**
 * Helper to build diagnostic sections with consistent formatting
 */
export function buildDiagnosticSection(
  sections: string[],
  title: string,
  content: (() => void) | string[],
  level = 2
): void {
  sections.push('');
  sections.push(`${'#'.repeat(level)} ${title}`);

  if (typeof content === 'function') {
    content();
  } else {
    sections.push(...content);
  }
}

/**
 * Helper to add key-value pairs with consistent formatting
 */
export function addKeyValuePairs(
  sections: string[],
  pairs: Record<string, string | number>
): void {
  for (const [key, value] of Object.entries(pairs)) {
    sections.push(`- **${key}:** ${value}`);
  }
}

/**
 * Helper to add list items with consistent formatting
 */
export function addListItems(
  sections: string[],
  items: string[],
  prefix = '-'
): void {
  for (const item of items) {
    sections.push(`${prefix} ${item}`);
  }
}

/**
 * Helper to add conditional content
 */
export function addIfNotEmpty<T>(
  sections: string[],
  items: T[],
  formatter: (item: T) => string
): void {
  if (items.length > 0) {
    for (const item of items) {
      sections.push(formatter(item));
    }
  }
}

/**
 * Helper to build performance metrics section
 */
export function buildPerformanceSection(
  sections: string[],
  metrics: {
    executionTime?: number;
    threshold?: number;
    status?: 'success' | 'warning' | 'error';
  }
): void {
  if (metrics.executionTime !== undefined) {
    const icon =
      metrics.threshold && metrics.executionTime > metrics.threshold
        ? '⚠️'
        : '✅';
    sections.push(`${icon} Execution time: ${metrics.executionTime}ms`);

    if (metrics.threshold && metrics.executionTime > metrics.threshold) {
      sections.push(`⚠️ Exceeded threshold (${metrics.threshold}ms)`);
    }
  }
}
