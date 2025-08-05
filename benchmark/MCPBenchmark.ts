/**
 * Main benchmark orchestrator
 */

import { BenchmarkConfig, DEFAULT_CONFIG } from './config.js';
import { BenchmarkScenario } from './types.js';
import { MCPServerManager } from './MCPServerManager.js';
import { BenchmarkEngine } from './BenchmarkEngine.js';
import { Reporter } from './Reporter.js';
import { ProcessUtils } from './utils.js';

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
    console.log('🎯 MCP Benchmark');
    console.log('=================');
    
    if (this.config.logging.verbose) {
      console.log('Configuration:', JSON.stringify(this.config, null, 2));
    }

    try {
      // Clean up any existing processes
      await ProcessUtils.cleanup();
      
      // Start servers
      await this.serverManager.startServers();
      
      // Run benchmarks
      await this.runBenchmarks(scenarios);
      
      // Generate reports
      this.generateReports();
      
    } catch (error) {
      console.error('❌ Benchmark failed:', (error as Error).message);
      
      if (this.config.logging.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      
      throw error;
    } finally {
      // Always clean up
      await this.cleanup();
    }
  }

  /**
   * Run benchmarks on both servers
   */
  private async runBenchmarks(scenarios: BenchmarkScenario[]): Promise<void> {
    // Run all scenarios on original server first
    console.log('\n🚀 Phase 1: Original Server Testing');
    console.log('=====================================');
    const originalResults = await this.engine.runAllScenariosOnServer('original', scenarios);
    
    // Stop original server and switch to fast server
    console.log('\n🔄 Switching servers...');
    await this.serverManager.stopServer('original');
    console.log('   Original server stopped');
    
    // Start fast server fresh
    console.log('   Starting fast server...');
    const fastConfig = this.config.servers.fast;
    const { spawn } = await import('child_process');
    
    const fastServer = spawn(fastConfig.command, fastConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...fastConfig.env },
      cwd: fastConfig.cwd || process.cwd()
    });
    
    // Update server manager with new fast server
    this.serverManager.servers.fast = fastServer;
    
    // Add error handler for new fast server
    fastServer.on('error', (err) => {
      console.error('Fast server error:', err);
    });
    
    // Initialize fast server connection
    console.log('   Initializing fast server...');
    await this.serverManager.initializeServer(fastServer, 'fast');
    
    // Run all scenarios on fast server
    console.log('\n🚀 Phase 2: Fast Server Testing');
    console.log('==================================');
    const fastResults = await this.engine.runAllScenariosOnServer('fast', scenarios);
    
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
    const successRates = this.reporter.getSuccessRate();
    console.log('\n📈 SUCCESS RATES');
    console.log('================');
    console.log(`Original server: ${successRates.original}%`);
    console.log(`Fast server: ${successRates.fast}%`);
    console.log(`Combined success: ${successRates.combined}%`);
    
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
    await ProcessUtils.wait(this.config.timeouts.processCleanup);
  }

  /**
   * Get benchmark results
   */
  getResults() {
    return this.reporter.getResults();
  }

  /**
   * Get summary statistics
   */
  getSummary() {
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
      errors
    };
  }
}