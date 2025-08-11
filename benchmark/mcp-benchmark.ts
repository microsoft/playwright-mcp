/**
 * Main benchmark orchestrator
 */

import { BenchmarkEngine } from './benchmark-engine.js';
import { type BenchmarkConfig, DEFAULT_CONFIG } from './config.js';
import { MCPServerManager } from './mcp-server-manager.js';
import { Reporter } from './reporter.js';
import type {
  BenchmarkResult,
  BenchmarkScenario,
  BenchmarkSummary,
} from './types.js';
import { cleanup, wait } from './utils.js';

export class MCPBenchmark {
  private config: BenchmarkConfig;
  private serverManager: MCPServerManager;
  private engine: BenchmarkEngine;
  private reporter: Reporter;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    // Merge provided config with defaults
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);

    // Initialize components
    this.serverManager = new MCPServerManager(this.config);
    this.engine = new BenchmarkEngine(this.config, this.serverManager);
    this.reporter = new Reporter();
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(
    defaultConfig: BenchmarkConfig,
    userConfig: Partial<BenchmarkConfig>
  ): BenchmarkConfig {
    const merged = { ...defaultConfig };

    if (userConfig.servers) {
      merged.servers = { ...defaultConfig.servers, ...userConfig.servers };
    }

    if (userConfig.timeouts) {
      merged.timeouts = { ...defaultConfig.timeouts, ...userConfig.timeouts };
    }

    if (userConfig.retries) {
      merged.retries = { ...defaultConfig.retries, ...userConfig.retries };
    }

    if (userConfig.output) {
      merged.output = { ...defaultConfig.output, ...userConfig.output };
    }

    if (userConfig.logging) {
      merged.logging = { ...defaultConfig.logging, ...userConfig.logging };
    }

    return merged;
  }

  /**
   * Run complete benchmark suite
   */
  async run(scenarios: BenchmarkScenario[]): Promise<void> {
    try {
      // Clean up any existing processes
      await cleanup();

      // Start servers
      await this.serverManager.startServers();

      // Run benchmarks
      await this.runBenchmarks(scenarios);

      // Generate reports
      this.generateReports();
    } finally {
      // Always clean up
      await this.cleanup();
    }
  }

  /**
   * Run benchmarks on both servers
   */
  private async runBenchmarks(scenarios: BenchmarkScenario[]): Promise<void> {
    const originalResults = await this.engine.runAllScenariosOnServer(
      'original',
      scenarios
    );
    await this.serverManager.stopServer('original');
    const fastConfig = this.config.servers.fast;
    const { spawn } = await import('node:child_process');

    const fastServer = spawn(fastConfig.command, fastConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...fastConfig.env },
      cwd: fastConfig.cwd || process.cwd(),
    });

    // Update server manager with new fast server
    this.serverManager.servers.fast = fastServer;

    // Add error handler for new fast server
    fastServer.on('error', (_err: Error) => {
      // Error is handled by the server manager
    });
    await this.serverManager.initializeServer(fastServer, 'fast');
    const fastResults = await this.engine.runAllScenariosOnServer(
      'fast',
      scenarios
    );

    // Process and store results
    this.reporter.processResults(originalResults, fastResults);
  }

  /**
   * Generate all reports
   */
  private generateReports(): void {
    // Print summary
    this.reporter.printSummary();

    // Print detailed analysis if verbose
    if (this.config.logging.verbose) {
      this.reporter.printDetailedAnalysis();
    }

    // Print success rates
    const _successRates = this.reporter.getSuccessRate();

    // Save results to file
    this.reporter.saveResults(
      this.config.output.resultsDirectory,
      this.config.output.filePrefix
    );
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    await this.serverManager.shutdown();
    this.engine.resetServerTracking();

    // Additional cleanup wait
    await wait(this.config.timeouts.processCleanup);
  }

  /**
   * Get benchmark results
   */
  getResults(): BenchmarkResult[] {
    return this.reporter.getResults();
  }

  /**
   * Get summary statistics
   */
  getSummary(): BenchmarkSummary['summary'] {
    return this.reporter.getSummary();
  }

  /**
   * Check if benchmark has valid results
   */
  hasValidResults(): boolean {
    return this.reporter.hasValidResults();
  }

  /**
   * Get current configuration
   */
  getConfig(): BenchmarkConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (for advanced use cases)
   */
  updateConfig(newConfig: Partial<BenchmarkConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig);
  }

  /**
   * Run a single scenario for testing
   */
  async runSingleScenario(scenario: BenchmarkScenario): Promise<void> {
    await this.run([scenario]);
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required commands exist
    if (!this.config.servers.original.command) {
      errors.push('Original server command is required');
    }

    if (!this.config.servers.fast.command) {
      errors.push('Fast server command is required');
    }

    // Check timeout values
    if (this.config.timeouts.initialization <= 0) {
      errors.push('Initialization timeout must be positive');
    }

    if (this.config.timeouts.toolCall <= 0) {
      errors.push('Tool call timeout must be positive');
    }

    // Check retry values
    if (this.config.retries.maxRetries < 0) {
      errors.push('Max retries cannot be negative');
    }

    if (this.config.retries.retryDelay < 0) {
      errors.push('Retry delay cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
