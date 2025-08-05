/*
 * Copyright (c) Microsoft Corporation.
 */

import { DiffSegment } from '../types/diff.js';

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
  formatUnified(segments: DiffSegment[], context: number = 3): string {
    if (segments.length === 0) return '';

    const lines: string[] = [];
    let hasChanges = false;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.type === 'add') {
        hasChanges = true;
        segment.value.split('\n').forEach(line => {
          if (line || segment.value.endsWith('\n')) {
            lines.push('+ ' + line);
          }
        });
      } else if (segment.type === 'remove') {
        hasChanges = true;
        segment.value.split('\n').forEach(line => {
          if (line || segment.value.endsWith('\n')) {
            lines.push('- ' + line);
          }
        });
      } else if (segment.type === 'equal' && hasChanges) {
        // Show context lines after changes
        const contextLines = segment.value.split('\n');
        const showLines = Math.min(context, contextLines.length);
        
        for (let j = 0; j < showLines && j < contextLines.length - 1; j++) {
          lines.push('  ' + contextLines[j]);
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

    segments.forEach(segment => {
      if (segment.type === 'remove') {
        segment.value.split('\n').forEach(line => {
          if (line || segment.value.endsWith('\n')) {
            removedLines.push(line);
          }
        });
      } else if (segment.type === 'add') {
        segment.value.split('\n').forEach(line => {
          if (line || segment.value.endsWith('\n')) {
            addedLines.push(line);
          }
        });
      }
    });

    const result: string[] = [];

    if (removedLines.length > 0) {
      result.push('--- Removed');
      removedLines.forEach(line => result.push(line));
    }

    if (addedLines.length > 0) {
      if (result.length > 0) result.push('');
      result.push('+++ Added');
      addedLines.forEach(line => result.push(line));
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

    segments.forEach(segment => {
      if (segment.type === 'add') {
        changes.push('+' + segment.value);
      } else if (segment.type === 'remove') {
        changes.push('-' + segment.value);
      }
    });

    return changes.join('');
  }

  /**
   * Apply highlighting to text based on change type
   * @param text Text to highlight
   * @param type Type of change ('add' or 'remove')
   * @returns Highlighted text
   */
  private highlightChanges(text: string, type: 'add' | 'remove'): string {
    if (!text) return text;

    // Simple ANSI color highlighting for terminal output
    const colors = {
      add: '\u001b[32m',    // Green
      remove: '\u001b[31m', // Red
      reset: '\u001b[0m'    // Reset
    };

    return `${colors[type]}${text}${colors.reset}`;
  }
}