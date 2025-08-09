/**
 * Utility functions for benchmark operations
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { ALTERNATIVE_URLS, KILL_COMMANDS } from './config.js';
import type {
  BenchmarkResult,
  BenchmarkSummary,
  MCPResponse,
} from './types.js';

/**
 * Kill existing MCP processes
 */
export async function cleanup(): Promise<void> {
  // Execute all kill commands in parallel
  const killPromises = KILL_COMMANDS.map(async ([cmd, ...args]) => {
    try {
      const proc = spawn(cmd, args);
      await new Promise<void>((resolve) => proc.on('exit', () => resolve()));
    } catch (_error: unknown) {
      // Ignore errors - process might not exist (this is expected)
    }
  });

  await Promise.all(killPromises);

  // Wait for processes to die
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));
}

/**
 * Create a promise that rejects after timeout
 */
export function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate that server process is running
 */
export function isProcessRunning(process: ChildProcess): boolean {
  return process && !process.killed && process.exitCode === null;
}

/**
 * Validate MCP response format
 */
export function isValidMCPResponse(response: unknown): response is MCPResponse {
  return Boolean(
    response &&
      typeof response === 'object' &&
      response !== null &&
      'jsonrpc' in response &&
      (response as { jsonrpc: unknown }).jsonrpc === '2.0' &&
      'id' in response &&
      (response as { id: unknown }).id !== undefined
  );
}

/**
 * Calculate response size and token count
 */
export function calculateMetrics(response: unknown): {
  size: number;
  tokens: number;
} {
  const responseText =
    response &&
    typeof response === 'object' &&
    response !== null &&
    'result' in response &&
    response.result &&
    typeof response.result === 'object' &&
    'content' in response.result &&
    Array.isArray(response.result.content) &&
    response.result.content.length > 0 &&
    response.result.content[0] &&
    typeof response.result.content[0] === 'object' &&
    'text' in response.result.content[0] &&
    typeof response.result.content[0].text === 'string'
      ? response.result.content[0].text
      : '';
  const size = JSON.stringify(response).length;
  const tokens = Math.ceil(responseText.length / 4); // Rough token estimation

  return { size, tokens };
}

/**
 * Calculate percentage reduction
 */
export function calculateReduction(
  original: number,
  optimized: number
): number {
  if (original === 0) {
    return 0;
  }
  return Number(((1 - optimized / original) * 100).toFixed(1));
}

/**
 * Generate benchmark summary
 */
export function generateSummary(
  results: BenchmarkResult[]
): BenchmarkSummary['summary'] {
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
    avgSizeReduction:
      validComparisons > 0
        ? calculateReduction(totalOriginalSize, totalFastSize)
        : 0,
    avgTokenReduction:
      validComparisons > 0
        ? calculateReduction(totalOriginalTokens, totalFastTokens)
        : 0,
    validComparisons,
  };
}

/**
 * Save results to file
 */
export function saveResults(
  results: BenchmarkResult[],
  directory: string,
  prefix: string
): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `${directory}/${prefix}-${timestamp}.json`;

  const output: BenchmarkSummary = {
    timestamp: new Date().toISOString(),
    results,
    summary: generateSummary(results),
  };

  writeFileSync(filename, JSON.stringify(output, null, 2));
  return filename;
}

/**
 * Get alternative URL for retry attempts
 */
export function getAlternativeUrl(
  retryCount: number,
  originalUrl: string
): string {
  if (retryCount > 0 && retryCount <= ALTERNATIVE_URLS.length) {
    return ALTERNATIVE_URLS[retryCount - 1];
  }

  return originalUrl;
}

/**
 * Execute operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  delay: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;

  // Retry attempts must run sequentially to respect retry delays
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // biome-ignore lint/nursery/noAwaitInLoop: Retry attempts must be executed sequentially to respect delays
      return await operation();
    } catch (error: unknown) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, lastError);
        await wait(delay);
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}
