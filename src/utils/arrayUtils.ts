/**
 * Array utility functions to reduce code duplication
 */

/**
 * Creates a new empty string array
 * @returns Empty string array
 */
export function createEmptyStringArray(): string[] {
  return [];
}

/**
 * Creates a new empty array of the specified type
 * @returns Empty array
 */
export function createEmptyArray<T>(): T[] {
  return [];
}
