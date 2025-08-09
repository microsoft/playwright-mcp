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
      const processedSegment = this.processUnifiedSegment(
        segment,
        lines,
        hasChanges,
        context
      );
      hasChanges = processedSegment.hasChanges;

      if (processedSegment.shouldBreak) {
        break;
      }
    }

    return hasChanges ? lines.join('\n') : '';
  }

  private processUnifiedSegment(
    segment: DiffSegment,
    lines: string[],
    hasChanges: boolean,
    context: number
  ): { hasChanges: boolean; shouldBreak: boolean } {
    if (segment.type === 'add') {
      this.addUnifiedLines(segment, lines, '+ ');
      return { hasChanges: true, shouldBreak: false };
    }

    if (segment.type === 'remove') {
      this.addUnifiedLines(segment, lines, '- ');
      return { hasChanges: true, shouldBreak: false };
    }

    if (segment.type === 'equal' && hasChanges) {
      return this.processEqualSegment(segment, lines, context);
    }

    return { hasChanges, shouldBreak: false };
  }

  private addUnifiedLines(
    segment: DiffSegment,
    lines: string[],
    prefix: string
  ): void {
    for (const line of segment.value.split('\n')) {
      if (line || segment.value.endsWith('\n')) {
        lines.push(`${prefix}${line}`);
      }
    }
  }

  private processEqualSegment(
    segment: DiffSegment,
    lines: string[],
    context: number
  ): { hasChanges: boolean; shouldBreak: boolean } {
    const contextLines = segment.value.split('\n');
    const showLines = Math.min(context, contextLines.length);

    for (let j = 0; j < showLines && j < contextLines.length - 1; j++) {
      lines.push(`  ${contextLines[j]}`);
    }

    const shouldBreak = contextLines.length > showLines;
    return { hasChanges: true, shouldBreak };
  }

  /**
   * Format diff in split format showing removals and additions separately
   * @param segments Array of diff segments
   * @returns Formatted diff string
   */
  formatSplit(segments: DiffSegment[]): string {
    const { removedLines, addedLines } = this.extractSplitLines(segments);
    return this.buildSplitOutput(removedLines, addedLines);
  }

  private extractSplitLines(segments: DiffSegment[]): {
    removedLines: string[];
    addedLines: string[];
  } {
    const removedLines: string[] = [];
    const addedLines: string[] = [];

    for (const segment of segments) {
      if (segment.type === 'remove') {
        this.addSplitLines(segment, removedLines);
      } else if (segment.type === 'add') {
        this.addSplitLines(segment, addedLines);
      }
    }

    return { removedLines, addedLines };
  }

  private addSplitLines(segment: DiffSegment, targetLines: string[]): void {
    for (const line of segment.value.split('\n')) {
      if (line || segment.value.endsWith('\n')) {
        targetLines.push(line);
      }
    }
  }

  private buildSplitOutput(
    removedLines: string[],
    addedLines: string[]
  ): string {
    const result: string[] = [];

    this.addSplitSection(result, removedLines, '--- Removed');
    this.addSplitSection(result, addedLines, '+++ Added', result.length > 0);

    return result.join('\n');
  }

  private addSplitSection(
    result: string[],
    lines: string[],
    header: string,
    addSeparator = false
  ): void {
    if (lines.length > 0) {
      if (addSeparator) {
        result.push('');
      }
      result.push(header);
      result.push(...lines);
    }
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
