#!/usr/bin/env node

/**
 * MCP Benchmark CLI
 */

import type { BenchmarkConfig } from './config.js';

/**
 * Main function
 */
async function main(): Promise<void> {
  // Optional: Custom configuration
  const customConfig: Partial<BenchmarkConfig> = {
    logging: {
      verbose: process.argv.includes('--verbose'),
      includeStepDetails: !process.argv.includes('--quiet'),
    },
  };

  const { MCPBenchmark } = await import('./mcp-benchmark.js');
  const { BENCHMARK_SCENARIOS } = await import('./scenarios.js');
  const benchmark = new MCPBenchmark(customConfig);

  // Validate configuration
  const validation = benchmark.validateConfig();
  if (!validation.valid) {
    // Configuration errors were previously logged here
    process.exit(1);
  }

  try {
    await benchmark.run(BENCHMARK_SCENARIOS);

    if (benchmark.hasValidResults()) {
      const _summary = benchmark.getSummary();
      // Summary results were previously logged here

      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (_error) {
    // Benchmark execution failed - exit with error code
    process.exit(1);
  }
}

/**
 * CLI help
 */
function showHelp(): void {
  // Help text would be displayed here
}

// Handle CLI arguments
if (process.argv.includes('--help')) {
  showHelp();
  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((_error) => {
    // Main process failed - exit with error code
    process.exit(1);
  });
}

export * from './config.js';
// Export for programmatic use
export { MCPBenchmark } from './mcp-benchmark.js';
export { BENCHMARK_SCENARIOS } from './scenarios.js';
export * from './types.js';
