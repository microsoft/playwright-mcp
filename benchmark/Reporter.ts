/**
 * Results reporting and analysis
 */

import { BenchmarkResult, BenchmarkSummary } from './types.js';
import { ResultUtils } from './utils.js';

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
    originalResults: Array<{ name: string; description: string; result: any }>,
    fastResults: Array<{ name: string; description: string; result: any }>
  ): void {
    console.log(`\n📊 COMPARISON RESULTS`);
    console.log(`=====================`);
    
    for (let i = 0; i < originalResults.length; i++) {
      const original = originalResults[i];
      const fast = fastResults[i];
      
      console.log(`\n📋 ${original.name}`);
      console.log(`   ${original.description}`);
      
      if (original.result.success && fast.result.success) {
        const sizeReduction = ResultUtils.calculateReduction(
          original.result.totalSize, 
          fast.result.totalSize
        );
        const tokenReduction = ResultUtils.calculateReduction(
          original.result.totalTokens, 
          fast.result.totalTokens
        );
        
        console.log(`   📊 Results:`);
        console.log(`      Size: ${original.result.totalSize} → ${fast.result.totalSize} bytes (${sizeReduction}% reduction)`);
        console.log(`      Tokens: ~${original.result.totalTokens} → ~${fast.result.totalTokens} (${tokenReduction}% reduction)`);
        
        // Store result for summary
        this.addResult({
          name: original.name,
          description: original.description,
          original: original.result,
          fast: fast.result
        });
      } else {
        console.log(`   ❌ Comparison failed - Original: ${original.result.success ? 'SUCCESS' : 'FAILED'}, Fast: ${fast.result.success ? 'SUCCESS' : 'FAILED'}`);
      }
    }
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    console.log('\n📊 SUMMARY');
    console.log('==========');
    
    const summary = ResultUtils.generateSummary(this.results);
    
    if (summary.validComparisons > 0) {
      console.log(`Valid comparisons: ${summary.validComparisons}`);
      console.log(`Average size reduction: ${summary.avgSizeReduction}%`);
      console.log(`Average token reduction: ${summary.avgTokenReduction}%`);
      console.log(`Total size: ${summary.totalOriginalSize} → ${summary.totalFastSize} bytes`);
      console.log(`Total tokens: ${summary.totalOriginalTokens} → ${summary.totalFastTokens}`);
    } else {
      console.log('❌ No valid comparisons available');
    }
  }

  /**
   * Print detailed analysis
   */
  printDetailedAnalysis(): void {
    console.log('\n📈 DETAILED ANALYSIS');
    console.log('====================');
    
    for (const result of this.results) {
      if (result.original.success && result.fast.success) {
        console.log(`\n🔍 ${result.name}:`);
        
        const sizeReduction = ResultUtils.calculateReduction(
          result.original.totalSize, 
          result.fast.totalSize
        );
        const tokenReduction = ResultUtils.calculateReduction(
          result.original.totalTokens, 
          result.fast.totalTokens
        );
        
        console.log(`   Size reduction: ${sizeReduction}%`);
        console.log(`   Token reduction: ${tokenReduction}%`);
        console.log(`   Steps: ${result.original.stepResults.length}`);
        
        // Show step-by-step comparison
        this.printStepComparison(result);
      }
    }
  }

  /**
   * Print step-by-step comparison for a result
   */
  private printStepComparison(result: BenchmarkResult): void {
    console.log('   Step details:');
    
    for (let i = 0; i < result.original.stepResults.length; i++) {
      const originalStep = result.original.stepResults[i];
      const fastStep = result.fast.stepResults[i];
      
      if (originalStep.error || fastStep.error) {
        console.log(`     Step ${i + 1}: ERROR`);
        if (originalStep.error) console.log(`       Original: ${originalStep.error}`);
        if (fastStep.error) console.log(`       Fast: ${fastStep.error}`);
      } else {
        const stepSizeReduction = ResultUtils.calculateReduction(
          originalStep.size, 
          fastStep.size
        );
        const stepTokenReduction = ResultUtils.calculateReduction(
          originalStep.tokens, 
          fastStep.tokens
        );
        
        console.log(`     Step ${i + 1}: ${stepSizeReduction}% size, ${stepTokenReduction}% tokens`);
      }
    }
  }

  /**
   * Save results to file
   */
  saveResults(directory: string, prefix: string): string {
    const filename = ResultUtils.saveResults(this.results, directory, prefix);
    console.log(`\n💾 Results saved to: ${filename}`);
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
    return ResultUtils.generateSummary(this.results);
  }

  /**
   * Check if there are any valid results
   */
  hasValidResults(): boolean {
    return this.results.some(result => 
      result.original.success && result.fast.success
    );
  }

  /**
   * Get success rate
   */
  getSuccessRate(): { original: number; fast: number; combined: number } {
    const total = this.results.length;
    if (total === 0) return { original: 0, fast: 0, combined: 0 };
    
    const originalSuccesses = this.results.filter(r => r.original.success).length;
    const fastSuccesses = this.results.filter(r => r.fast.success).length;
    const combinedSuccesses = this.results.filter(r => r.original.success && r.fast.success).length;
    
    return {
      original: Math.round((originalSuccesses / total) * 100),
      fast: Math.round((fastSuccesses / total) * 100),
      combined: Math.round((combinedSuccesses / total) * 100)
    };
  }
}