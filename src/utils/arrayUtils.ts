/**
 * Array utilities to reduce code duplication
 */

/**
 * Remove duplicate items from array and optionally limit results
 * Replaces common pattern: [...new Set(items)].slice(0, limit)
 */
export function deduplicateAndLimit<T>(items: T[], limit?: number): T[] {
  const unique = [...new Set(items)];
  return limit ? unique.slice(0, limit) : unique;
}

/**
 * Remove duplicate items from array
 * Replaces common pattern: [...new Set(items)]
 */
export function deduplicate<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Limit array to specified number of items
 * Safe slice operation with bounds checking
 */
export function limitItems<T>(items: T[], limit: number): T[] {
  return limit > 0 ? items.slice(0, limit) : items;
}

/**
 * Remove empty or null/undefined items from array
 * Common pattern in suggestion filtering
 */
export function filterTruthy<T>(items: (T | null | undefined)[]): T[] {
  return items.filter((item): item is T => Boolean(item));
}

/**
 * Join array items with separator, filtering empty values
 * Common pattern in diagnostic report building
 */
export function joinFiltered(
  items: (string | null | undefined)[],
  separator = '\n'
): string {
  return filterTruthy(items).join(separator);
}
