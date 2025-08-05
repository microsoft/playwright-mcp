#!/usr/bin/env node

/**
 * MCP Benchmark CLI
 */

import { MCPBenchmark } from './MCPBenchmark.js';
import { BENCHMARK_SCENARIOS } from './scenarios.js';
import { BenchmarkConfig } from './config.js';

/**
 * Main function
 */
async function main(): Promise<void> {
  // Optional: Custom configuration
  const customConfig: Partial<BenchmarkConfig> = {
    logging: {
      verbose: process.argv.includes('--verbose'),
      includeStepDetails: !process.argv.includes('--quiet')
    }
  };

  const benchmark = new MCPBenchmark(customConfig);

  // Validate configuration
  const validation = benchmark.validateConfig();
  if (!validation.valid) {
    console.error('❌ Configuration validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  try {
    await benchmark.run(BENCHMARK_SCENARIOS);
    
    if (benchmark.hasValidResults()) {
      console.log('\n✅ Benchmark completed successfully');
      
      const summary = benchmark.getSummary();
      if (summary.validComparisons > 0) {
        console.log(`🎉 Average improvements: ${summary.avgSizeReduction}% size, ${summary.avgTokenReduction}% tokens`);
      }
    } else {
      console.log('\n⚠️  Benchmark completed but no valid comparisons were made');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Benchmark failed:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * CLI help
 */
function showHelp(): void {
  console.log(`
MCP Benchmark Tool

Usage: node benchmark/index.js [options]

Options:
  --verbose    Enable verbose logging with detailed analysis
  --quiet      Minimize step details in output
  --help       Show this help message

Examples:
  node benchmark/index.js                # Run with default settings
  node benchmark/index.js --verbose      # Run with detailed output
  node benchmark/index.js --quiet        # Run with minimal output
`);
}

// Handle CLI arguments
if (process.argv.includes('--help')) {
  showHelp();
  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { MCPBenchmark, BENCHMARK_SCENARIOS };
export * from './types.js';
export * from './config.js';