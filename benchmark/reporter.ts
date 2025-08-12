/**
 * Results reporting and analysis
 */

import type {
  BenchmarkResult,
  BenchmarkSummary,
  ScenarioResult,
} from './types.js';
import { calculateReduction, generateSummary, saveResults } from './utils.js';

export class Reporter {
  private results: BenchmarkResult[] = [];

  /**
   * Add a benchmark result
   */
  addResult(result: BenchmarkResult): void {
    this.results.push(result);
  }

  /**
   * Process and display comparison results
   */
  processResults(
    originalResults: Array<{
      name: string;
      description: string;
      result: ScenarioResult;
    }>,
    fastResults: Array<{
      name: string;
      description: string;
      result: ScenarioResult;
    }>
  ): void {
    for (const [i, original] of originalResults.entries()) {
      const fast = fastResults[i];

      if (original.result.success && fast.result.success) {
        const _sizeReduction = calculateReduction(
          original.result.totalSize,
          fast.result.totalSize
        );
        const _tokenReduction = calculateReduction(
          original.result.totalTokens,
          fast.result.totalTokens
        );

        // Store result for summary
        this.addResult({
          name: original.name,
          description: original.description,
          original: original.result,
          fast: fast.result,
        });
      }
    }
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    const _summary = generateSummary(this.results);

    // Summary statistics were previously logged here
  }

  /**
   * Print detailed analysis
   */
  printDetailedAnalysis(): void {
    for (const result of this.results) {
      if (result.original.success && result.fast.success) {
        const _sizeReduction = calculateReduction(
          result.original.totalSize,
          result.fast.totalSize
        );
        const _tokenReduction = calculateReduction(
          result.original.totalTokens,
          result.fast.totalTokens
        );

        // Show step-by-step comparison
        this.printStepComparison(result);
      }
    }
  }

  /**
   * Print step-by-step comparison for a result
   */
  private printStepComparison(result: BenchmarkResult): void {
    for (const [i, originalStep] of result.original.stepResults.entries()) {
      const fastStep = result.fast.stepResults[i];

      if (originalStep.error || fastStep.error) {
        // Error details were previously logged here
      } else {
        const _stepSizeReduction = calculateReduction(
          originalStep.size,
          fastStep.size
        );
        const _stepTokenReduction = calculateReduction(
          originalStep.tokens,
          fastStep.tokens
        );
      }
    }
  }

  /**
   * Save results to file
   */
  saveResults(directory: string, prefix: string): string {
    const filename = saveResults(this.results, directory, prefix);
    return filename;
  }

  /**
   * Get results for external processing
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): BenchmarkSummary['summary'] {
    return generateSummary(this.results);
  }

  /**
   * Check if there are any valid results
   */
  hasValidResults(): boolean {
    return this.results.some(
      (result) => result.original.success && result.fast.success
    );
  }

  /**
   * Get success rate
   */
  getSuccessRate(): { original: number; fast: number; combined: number } {
    const total = this.results.length;
    if (total === 0) {
      return { original: 0, fast: 0, combined: 0 };
    }

    const originalSuccesses = this.results.filter(
      (r) => r.original.success
    ).length;
    const fastSuccesses = this.results.filter((r) => r.fast.success).length;
    const combinedSuccesses = this.results.filter(
      (r) => r.original.success && r.fast.success
    ).length;

    return {
      original: Math.round((originalSuccesses / total) * 100),
      fast: Math.round((fastSuccesses / total) * 100),
      combined: Math.round((combinedSuccesses / total) * 100),
    };
  }
}
