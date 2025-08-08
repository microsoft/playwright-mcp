import type { DiffSegment } from '../types/diff.js';

/**
 * DiffFormatter provides different formatting options for diff output
 * to optimize readability and token usage based on use case.
 */
export class DiffFormatter {
  /**
   * Format diff in unified format (similar to git diff)
   * Shows additions and removals with context lines
   * @param segments Array of diff segments
   * @param context Number of context lines to show around changes
   * @returns Formatted diff string
   */
  formatUnified(segments: DiffSegment[], context = 3): string {
    if (segments.length === 0) {
      return '';
    }

    const lines: string[] = [];
    let hasChanges = false;

    for (const segment of segments) {
      if (segment.type === 'add') {
        hasChanges = true;
        for (const line of segment.value.split('\n')) {
          if (line || segment.value.endsWith('\n')) {
            lines.push(`+ ${line}`);
          }
        }
      } else if (segment.type === 'remove') {
        hasChanges = true;
        for (const line of segment.value.split('\n')) {
          if (line || segment.value.endsWith('\n')) {
            lines.push(`- ${line}`);
          }
        }
      } else if (segment.type === 'equal' && hasChanges) {
        // Show context lines after changes
        const contextLines = segment.value.split('\n');
        const showLines = Math.min(context, contextLines.length);
        for (let j = 0; j < showLines && j < contextLines.length - 1; j++) {
          lines.push(`  ${contextLines[j]}`);
        }
        // Stop adding context after showing requested lines
        if (contextLines.length > showLines) {
          break;
        }
      }
    }

    return hasChanges ? lines.join('\n') : '';
  }

  /**
   * Format diff in split format showing removals and additions separately
   * @param segments Array of diff segments
   * @returns Formatted diff string
   */
  formatSplit(segments: DiffSegment[]): string {
    const removedLines: string[] = [];
    const addedLines: string[] = [];

    for (const segment of segments) {
      if (segment.type === 'remove') {
        for (const line of segment.value.split('\n')) {
          if (line || segment.value.endsWith('\n')) {
            removedLines.push(line);
          }
        }
      } else if (segment.type === 'add') {
        for (const line of segment.value.split('\n')) {
          if (line || segment.value.endsWith('\n')) {
            addedLines.push(line);
          }
        }
      }
    }

    const result: string[] = [];
    if (removedLines.length > 0) {
      result.push('--- Removed');
      for (const line of removedLines) {
        result.push(line);
      }
    }
    if (addedLines.length > 0) {
      if (result.length > 0) {
        result.push('');
      }
      result.push('+++ Added');
      for (const line of addedLines) {
        result.push(line);
      }
    }
    return result.join('\n');
  }

  /**
   * Format diff in minimal format showing only the changes
   * @param segments Array of diff segments
   * @returns Formatted diff string
   */
  formatMinimal(segments: DiffSegment[]): string {
    const changes: string[] = [];
    for (const segment of segments) {
      if (segment.type === 'add') {
        changes.push(`+${segment.value}`);
      } else if (segment.type === 'remove') {
        changes.push(`-${segment.value}`);
      }
    }
    return changes.join('');
  }
}
