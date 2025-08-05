#!/usr/bin/env node

/**
 * Real MCP Client Benchmark
 * 
 * This script creates actual MCP clients to connect to both original and fast
 * Playwright MCP servers and measure real performance metrics.
 */  

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { scenarios, estimateTokens } from './scenarios.js';
import { writeFileSync } from 'fs';

class MCPClientBenchmark {
  constructor() {
    this.results = [];
    this.servers = {
      original: null,
      fast: null
    };
  }

  /**
   * Start MCP servers as child processes
   */
  async startMCPServers() {
    console.log('🚀 Starting MCP servers...');
    
    // Start original playwright MCP server
    this.servers.original = spawn('npx', ['-y', '@playwright/mcp@latest', '--isolated'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    // Start fast playwright MCP server
    this.servers.fast = spawn('node', ['cli.js', '--isolated'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: '/Users/tomohiko/fast-playwright-mcp'
    });

    // Log stderr for debugging
    this.servers.fast.stderr.on('data', (data) => {
      console.log(`Fast server stderr: ${data.toString().trim()}`);
    });

    // Wait a bit for servers to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ MCP servers started');
    return { original: this.servers.original, fast: this.servers.fast };
  }

  /**
   * Create MCP client connection
   */
  async createMCPClient(serverProcess) {
    let initialized = false;
    let nextId = 1;
    
    // Initialize the MCP connection
    await this.initializeMCPConnection(serverProcess);
    initialized = true;
    
    // Give server time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      callTool: async (toolName, args = {}) => {
        const startTime = performance.now();
        
        // Create MCP request
        const request = {
          jsonrpc: '2.0',
          id: nextId++,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        };

        try {
          // Send request to server
          const response = await this.sendMCPRequest(serverProcess, request);
          const endTime = performance.now();
          
          const executionTime = endTime - startTime;
          const responseText = JSON.stringify(response);
          const responseSize = responseText.length;
          const tokenCount = estimateTokens(responseText);

          return {
            success: true,
            executionTime,
            responseSize,
            tokenCount,
            response,
            responseText
          };
        } catch (error) {
          const endTime = performance.now();
          const executionTime = endTime - startTime;
          
          return {
            success: false,
            executionTime,
            responseSize: 0,
            tokenCount: 0,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Initialize MCP connection
   */
  async initializeMCPConnection(serverProcess) {
    const initRequest = {
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'benchmark-client',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendMCPRequest(serverProcess, initRequest);
    if (response.error) {
      throw new Error(`MCP initialization failed: ${response.error.message}`);
    }
    
    // Send initialized notification
    const initNotification = {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {}
    };
    
    serverProcess.stdin.write(JSON.stringify(initNotification) + '\n');
    
    return response.result;
  }

  /**
   * Send MCP request and wait for response
   */
  async sendMCPRequest(serverProcess, request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Request timeout for ${request.method} (id: ${request.id})`));
      }, 10000); // 10 second timeout

      let responseBuffer = '';
      
      const onData = (data) => {
        responseBuffer += data.toString();
        
        // Process complete JSON lines
        let lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line.trim());
              
              // Check if this is the response we're waiting for
              if (response.id === request.id || (request.id === 'init' && response.id === 'init')) {
                cleanup();
                resolve(response);
                return;
              }
              
              // Log other messages for debugging
              if (response.id !== request.id) {
                console.log(`  📝 Received message: ${JSON.stringify(response).substring(0, 100)}...`);
              }
            } catch (e) {
              console.log(`  ⚠️  Failed to parse line: ${line.substring(0, 100)}...`);
            }
          }
        }
      };

      const onError = (error) => {
        cleanup();
        reject(new Error(`Server error: ${error.message}`));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        serverProcess.stdout.off('data', onData);
        serverProcess.stderr.off('data', onError);
      };

      serverProcess.stdout.on('data', onData);
      serverProcess.stderr.on('data', onError);
      
      // Send request
      try {
        serverProcess.stdin.write(JSON.stringify(request) + '\n');
      } catch (error) {
        cleanup();
        reject(new Error(`Failed to send request: ${error.message}`));
      }
    });
  }

  /**
   * Execute a single scenario on a specific server
   */
  async executeScenario(scenario, serverType, serverProcess) {
    console.log(`\n🧪 Running "${scenario.name}" on ${serverType} server`);
    
    const client = await this.createMCPClient(serverProcess);
    const results = [];
    let totalTime = 0;
    let totalSize = 0;
    let totalTokens = 0;

    const steps = (serverType === 'fast' && scenario.fastSteps) ? scenario.fastSteps : scenario.steps;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const args = (serverType === 'fast' && step.fastArgs) ? step.fastArgs : step.args;
      
      console.log(`  ⏳ Step ${i + 1}/${steps.length}: ${step.tool}`);
      
      const result = await client.callTool(step.tool, args);
      results.push(result);
      
      if (result.success) {
        totalTime += result.executionTime;
        totalSize += result.responseSize;
        totalTokens += result.tokenCount;
        console.log(`    ✅ Completed in ${result.executionTime.toFixed(2)}ms`);
      } else {
        console.log(`    ❌ Failed: ${result.error}`);
      }
    }

    return {
      scenarioName: scenario.name,
      serverType,
      totalTime,
      totalSize,
      totalTokens,
      stepCount: steps.length,
      stepResults: results
    };
  }

  /**
   * Run full benchmark comparing both servers
   */
  async runFullBenchmark() {
    console.log('🎯 Starting Real MCP Client Benchmark');
    console.log('======================================\n');

    try {
      // Start servers
      await this.startMCPServers();

      const allResults = [];

      // Run each scenario on both servers
      for (const scenario of scenarios.slice(0, 2)) { // Limit to first 2 scenarios for testing
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📋 SCENARIO: ${scenario.name}`);
        console.log(`📝 ${scenario.description}`);
        console.log(`${'='.repeat(60)}`);

        try {
          // Run on original server
          const originalResult = await this.executeScenario(scenario, 'original', this.servers.original);
          
          // Small delay between tests
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Run on fast server  
          const fastResult = await this.executeScenario(scenario, 'fast', this.servers.fast);

          // Calculate improvements
          const timeImprovement = originalResult.totalTime > 0 
            ? ((originalResult.totalTime - fastResult.totalTime) / originalResult.totalTime * 100)
            : 0;
          const sizeChange = originalResult.totalSize > 0
            ? ((fastResult.totalSize - originalResult.totalSize) / originalResult.totalSize * 100)
            : 0;
          const tokenChange = originalResult.totalTokens > 0
            ? ((fastResult.totalTokens - originalResult.totalTokens) / originalResult.totalTokens * 100)
            : 0;

          const comparison = {
            name: scenario.name,
            description: scenario.description,
            original: originalResult,
            fast: fastResult,
            improvements: {
              time: timeImprovement,
              size: -sizeChange, // Negative because we want reduction to be positive
              tokens: -tokenChange
            }
          };

          allResults.push(comparison);

          console.log(`\n📈 COMPARISON RESULTS:`);
          console.log(`   Original: ${originalResult.totalTime.toFixed(2)}ms, ${originalResult.totalSize} bytes, ~${originalResult.totalTokens} tokens`);
          console.log(`   Fast:     ${fastResult.totalTime.toFixed(2)}ms, ${fastResult.totalSize} bytes, ~${fastResult.totalTokens} tokens`);
          console.log(`   Performance: ${timeImprovement.toFixed(1)}% faster, ${(-sizeChange).toFixed(1)}% size change, ${(-tokenChange).toFixed(1)}% token change`);

        } catch (error) {
          console.error(`❌ Error running scenario "${scenario.name}":`, error.message);
        }
      }

      // Generate final report
      this.generateFinalReport(allResults);

    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    } finally {
      // Clean up servers
      this.cleanup();
    }
  }

  /**
   * Generate final benchmark report
   */
  generateFinalReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 REAL MCP BENCHMARK RESULTS');
    console.log('='.repeat(80));

    if (results.length === 0) {
      console.log('No successful results to report.');
      return;
    }

    // Calculate averages
    const validResults = results.filter(r => r.original && r.fast);
    if (validResults.length > 0) {
      const avgTimeImprovement = validResults.reduce((sum, r) => sum + r.improvements.time, 0) / validResults.length;
      const avgSizeChange = validResults.reduce((sum, r) => sum + r.improvements.size, 0) / validResults.length;
      const avgTokenChange = validResults.reduce((sum, r) => sum + r.improvements.tokens, 0) / validResults.length;

      console.log('\n📈 SUMMARY:');
      console.log(`   Average time improvement: ${avgTimeImprovement.toFixed(1)}%`);
      console.log(`   Average size change: ${avgSizeChange.toFixed(1)}%`);
      console.log(`   Average token change: ${avgTokenChange.toFixed(1)}%`);
    }

    console.log('\n📋 DETAILED RESULTS:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}`);
      if (result.original && result.fast) {
        console.log(`   Time: ${result.original.totalTime.toFixed(2)}ms → ${result.fast.totalTime.toFixed(2)}ms (${result.improvements.time.toFixed(1)}% improvement)`);
        console.log(`   Size: ${result.original.totalSize} → ${result.fast.totalSize} bytes (${result.improvements.size.toFixed(1)}% change)`);
        console.log(`   Tokens: ~${result.original.totalTokens} → ~${result.fast.totalTokens} (${result.improvements.tokens.toFixed(1)}% change)`);
      }
    });

    // Save results
    this.saveResults(results);
  }

  /**
   * Save results to file
   */
  saveResults(results) {
    const report = {
      timestamp: new Date().toISOString(),
      benchmarkType: 'real-mcp-client',
      results
    };

    const filename = `real-benchmark-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    const filepath = `/Users/tomohiko/fast-playwright-mcp/benchmark/${filename}`;

    try {
      writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);
    } catch (error) {
      console.error('❌ Error saving results:', error.message);
    }
  }

  /**
   * Clean up server processes
   */
  cleanup() {
    console.log('\n🧹 Cleaning up servers...');
    
    if (this.servers.original) {
      this.servers.original.kill();
    }
    if (this.servers.fast) {
      this.servers.fast.kill();
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Example usage for testing MCP communication
class MCPTestRunner {
  /**
   * Test basic MCP communication
   */
  static async testMCPCommunication() {
    console.log('🧪 Testing basic MCP communication...\n');
    
    const benchmark = new MCPClientBenchmark();
    
    try {
      await benchmark.startMCPServers();
      
      // Test original server
      console.log('Testing original server:');
      const originalClient = await benchmark.createMCPClient(benchmark.servers.original);
      const originalResult = await originalClient.callTool('browser_navigate', { url: 'https://httpbin.org/html' });
      console.log('Original result:', originalResult.success ? 'SUCCESS' : 'FAILED');
      if (originalResult.success) {
        console.log(`  Time: ${originalResult.executionTime.toFixed(2)}ms`);
        console.log(`  Size: ${originalResult.responseSize} bytes`);
      }

      // Test fast server
      console.log('\nTesting fast server:');
      try {
        const fastClient = await benchmark.createMCPClient(benchmark.servers.fast);
        const fastResult = await fastClient.callTool('browser_console_messages', {});
        console.log('Fast result:', fastResult.success ? 'SUCCESS' : 'FAILED');
        if (fastResult.success) {
          console.log(`  Time: ${fastResult.executionTime.toFixed(2)}ms`);
          console.log(`  Size: ${fastResult.responseSize} bytes`);
        } else {
          console.log(`  Error: ${fastResult.error}`);
        }
      } catch (error) {
        console.log('Fast result: FAILED');
        console.log(`  Error: ${error.message}`);
      }

    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      benchmark.cleanup();
    }
  }
}

// Export classes
export { MCPClientBenchmark, MCPTestRunner };

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'test') {
    // Run basic communication test
    MCPTestRunner.testMCPCommunication()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
      });
  } else {
    // Run full benchmark
    const benchmark = new MCPClientBenchmark();
    benchmark.runFullBenchmark()
      .then(() => {
        console.log('\n✅ Real MCP benchmark completed!');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n❌ Benchmark failed:', error);
        process.exit(1);
      });
  }
}