/**
 * Utility functions for benchmark operations
 */

import { spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';
import { KILL_COMMANDS, ALTERNATIVE_URLS } from './config.js';
import { BenchmarkResult, BenchmarkSummary } from './types.js';

export class ProcessUtils {
  /**
   * Kill existing MCP processes
   */
  static async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up existing processes...');

    for (const [cmd, ...args] of KILL_COMMANDS) {
      try {
        const proc = spawn(cmd, args);
        await new Promise<void>(resolve => proc.on('exit', () => resolve()));
      } catch (e) {
        // Ignore errors - process might not exist
      }
    }

    // Wait for processes to die
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Create a promise that rejects after timeout
   */
  static createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Wait for a specified duration
   */
  static async wait(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }
}

export class ValidationUtils {
  /**
   * Validate that server process is running
   */
  static isProcessRunning(process: ChildProcess): boolean {
    return process && !process.killed && process.exitCode === null;
  }

  /**
   * Validate MCP response format
   */
  static isValidMCPResponse(response: any): boolean {
    return response &&
           typeof response === 'object' &&
           response.jsonrpc === '2.0' &&
           response.id !== undefined;
  }
}

export class ResultUtils {
  /**
   * Calculate response size and token count
   */
  static calculateMetrics(response: any): { size: number; tokens: number } {
    const responseText = response.result?.content?.[0]?.text || '';
    const size = JSON.stringify(response).length;
    const tokens = Math.ceil(responseText.length / 4); // Rough token estimation

    return { size, tokens };
  }

  /**
   * Calculate percentage reduction
   */
  static calculateReduction(original: number, optimized: number): number {
    if (original === 0)
      return 0;
    return Number(((1 - optimized / original) * 100).toFixed(1));
  }

  /**
   * Generate benchmark summary
   */
  static generateSummary(results: BenchmarkResult[]): BenchmarkSummary['summary'] {
    let totalOriginalSize = 0;
    let totalFastSize = 0;
    let totalOriginalTokens = 0;
    let totalFastTokens = 0;
    let validComparisons = 0;

    for (const result of results) {
      if (result.original.success && result.fast.success) {
        totalOriginalSize += result.original.totalSize;
        totalFastSize += result.fast.totalSize;
        totalOriginalTokens += result.original.totalTokens;
        totalFastTokens += result.fast.totalTokens;
        validComparisons++;
      }
    }

    return {
      totalOriginalSize,
      totalFastSize,
      totalOriginalTokens,
      totalFastTokens,
      avgSizeReduction: validComparisons > 0 ?
        this.calculateReduction(totalOriginalSize, totalFastSize) : 0,
      avgTokenReduction: validComparisons > 0 ?
        this.calculateReduction(totalOriginalTokens, totalFastTokens) : 0,
      validComparisons
    };
  }

  /**
   * Save results to file
   */
  static saveResults(results: BenchmarkResult[], directory: string, prefix: string): string {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${directory}/${prefix}-${timestamp}.json`;

    const output: BenchmarkSummary = {
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateSummary(results)
    };

    writeFileSync(filename, JSON.stringify(output, null, 2));
    return filename;
  }
}

export class RetryUtils {
  /**
   * Get alternative URL for retry attempts
   */
  static getAlternativeUrl(retryCount: number, originalUrl: string): string {
    if (retryCount > 0 && retryCount <= ALTERNATIVE_URLS.length)
      return ALTERNATIVE_URLS[retryCount - 1];

    return originalUrl;
  }

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delay: number,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          onRetry?.(attempt + 1, lastError);
          await ProcessUtils.wait(delay);
        }
      }
    }

    throw lastError!;
  }
}
