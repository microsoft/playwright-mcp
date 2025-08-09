import type { ExpectationOptions } from '../schemas/expectation.js';
/**
 * Console message interface for filtering
 */
export interface ConsoleMessage {
  type?: string;
  toString(): string;
}
/**
 * Filter console messages based on provided options
 */
export function filterConsoleMessages(
  messages: ConsoleMessage[],
  options?: NonNullable<ExpectationOptions>['consoleOptions']
): ConsoleMessage[] {
  if (!options) {
    return messages;
  }
  let filtered = messages;
  // Level-based filtering (existing functionality)
  if (options.levels && options.levels.length > 0) {
    filtered = filtered.filter((msg) => {
      const level = msg.type ?? 'log';
      return options.levels?.includes(
        level as 'log' | 'warn' | 'error' | 'info'
      );
    });
  }
  // Pattern matching filtering (new feature)
  if (options.patterns && options.patterns.length > 0) {
    filtered = filtered.filter((msg) => {
      const text = msg.toString();
      return options.patterns?.some((pattern) => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(text);
        } catch {
          // Invalid regex - fall back to substring matching
          return text.includes(pattern);
        }
      });
    });
  }
  // Remove duplicate messages (new feature)
  if (options.removeDuplicates) {
    const seen = new Set<string>();
    filtered = filtered.filter((msg) => {
      const key = `${msg.type ?? 'log'}:${msg.toString()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  // Message count limitation (improved existing functionality)
  const maxMessages = options.maxMessages ?? 10;
  if (filtered.length > maxMessages) {
    // Keep the most recent messages
    filtered = filtered.slice(-maxMessages);
  }
  return filtered;
}
