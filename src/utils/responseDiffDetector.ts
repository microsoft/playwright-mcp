import { createHash } from 'crypto';
import diff from 'fast-diff';
import { DiffOptions, DiffResult, DiffSegment, ResponseStorage, DiffMetadata } from '../types/diff.js';
import { DiffFormatter } from './diffFormatter.js';
/**
 * ResponseDiffDetector handles diff detection between consecutive responses
 * for the same tool, providing efficient token usage through change detection.
 */
export class ResponseDiffDetector {
  private readonly storage: Map<string, ResponseStorage> = new Map();
  private readonly formatter: DiffFormatter = new DiffFormatter();
  /**
   * Detect differences between current response and previously stored response
   * @param current Current response content
   * @param toolName Name of the tool that generated the response
   * @param options Diff detection options
   * @returns Diff result with formatted differences
   */
  async detectDiff(current: string, toolName: string, options: DiffOptions): Promise<DiffResult> {
    const cacheKey = this.generateCacheKey(toolName);
    const previous = this.storage.get(cacheKey);
    if (!previous) {
      // First call for this tool - no differences to detect
      this.storeResponse(current, toolName);
      return {
        hasDifference: false,
        similarity: 1.0,
        formattedDiff: '',
        metadata: {
          addedLines: 0,
          removedLines: 0,
          contextLines: 0,
          totalLines: current.split('\n').length
        }
      };
    }
    const diffSegments = this.calculateDiff(previous.content, current);
    const similarity = this.calculateSimilarity(previous.content, current);
    const hasDifference = similarity < (1 - options.threshold);
    let formattedDiff = '';
    const metadata: DiffMetadata = {
      addedLines: 0,
      removedLines: 0,
      contextLines: 0,
      totalLines: current.split('\n').length
    };
    if (hasDifference) {
      // Calculate metadata
      diffSegments.forEach(segment => {
        if (segment.type === 'add')
          metadata.addedLines += segment.value.split('\n').length - 1;
        else if (segment.type === 'remove')
          metadata.removedLines += segment.value.split('\n').length - 1;
        else
          metadata.contextLines += segment.value.split('\n').length - 1;
      });
      // Format the diff based on requested format
      switch (options.format) {
        case 'unified':
          formattedDiff = this.formatter.formatUnified(diffSegments, options.context);
          break;
        case 'split':
          formattedDiff = this.formatter.formatSplit(diffSegments);
          break;
        case 'minimal':
          formattedDiff = this.formatter.formatMinimal(diffSegments);
          break;
      }
      // Limit output size
      if (formattedDiff.split('\n').length > options.maxDiffLines) {
        const lines = formattedDiff.split('\n');
        formattedDiff = lines.slice(0, options.maxDiffLines).join('\n') +
          `\n... (${lines.length - options.maxDiffLines} more lines truncated)`;
      }
    }
    // Store current response for next comparison
    this.storeResponse(current, toolName);
    return {
      hasDifference,
      similarity,
      formattedDiff,
      metadata
    };
  }
  /**
   * Store response content for future diff comparison
   * @param content Response content to store
   * @param toolName Name of the tool that generated the response
   */
  storeResponse(content: string, toolName: string): void {
    const cacheKey = this.generateCacheKey(toolName);
    const hash = createHash('sha256').update(content).digest('hex');
    this.storage.set(cacheKey, {
      toolName,
      timestamp: Date.now(),
      content,
      hash
    });
  }
  /**
   * Generate cache key for tool-specific storage
   * @param toolName Name of the tool
   * @returns Cache key string
   */
  private generateCacheKey(toolName: string): string {
    return `diff_cache_${toolName}`;
  }
  /**
   * Calculate diff segments using fast-diff library
   * @param oldText Previous content
   * @param newText Current content
   * @returns Array of diff segments
   */
  private calculateDiff(oldText: string, newText: string): DiffSegment[] {
    const result = diff(oldText, newText);
    return result.map(([type, value]) => ({
      type: type === -1 ? 'remove' : type === 1 ? 'add' : 'equal',
      value
    }));
  }
  /**
   * Calculate similarity ratio between two strings
   * @param text1 First text
   * @param text2 Second text
   * @returns Similarity ratio (0.0 to 1.0)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2)
      return 1.0;
    if (text1.length === 0 && text2.length === 0)
      return 1.0;
    if (text1.length === 0 || text2.length === 0)
      return 0.0;
    const diffSegments = this.calculateDiff(text1, text2);
    let equalChars = 0;
    let totalChars = 0;
    diffSegments.forEach(segment => {
      totalChars += segment.value.length;
      if (segment.type === 'equal')
        equalChars += segment.value.length;
    });
    return totalChars > 0 ? equalChars / totalChars : 0.0;
  }
}
