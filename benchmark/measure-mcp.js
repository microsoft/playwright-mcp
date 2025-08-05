#!/usr/bin/env node

/**
 * MCP Response Measurement Tool
 * 
 * This tool helps measure response size and estimate token usage
 * from MCP responses for benchmarking purposes.
 */

import { scenarios, estimateTokens, formatResults } from './scenarios.js';

// Results storage
const results = [];

/**
 * Instructions for manual benchmarking
 */
console.log(`
=== Playwright MCP Benchmark Instructions ===

This tool will help you compare the original playwright-mcp with fast-playwright-mcp.

For each scenario, you'll need to:
1. Execute the commands using the original playwright MCP
2. Execute the commands using fast-playwright MCP  
3. Record the results

The tool will help you track:
- Execution time
- Response size (copy the full response text)
- Estimated token count

Ready to start? Make sure both MCP servers are available in Claude Code.

---
`);

/**
 * Create a measurement helper
 */
export function createMeasurement(scenarioName, serverType) {
  const startTime = Date.now();
  
  return {
    complete: (responseText) => {
      const endTime = Date.now();
      const time = endTime - startTime;
      const size = responseText.length;
      const tokens = estimateTokens(responseText);
      
      console.log(`\n${serverType} Results for "${scenarioName}":`);
      console.log(`- Time: ${time}ms`);
      console.log(`- Size: ${size} bytes`);
      console.log(`- Tokens: ~${tokens}`);
      
      return { time, size, tokens };
    }
  };
}

/**
 * Generate test commands for a scenario
 */
export function generateCommands(scenario, useFast = false) {
  console.log(`\n=== ${scenario.name} ===`);
  console.log(`Description: ${scenario.description}`);
  console.log(`\nCommands to execute:`);
  
  scenario.steps.forEach((step, index) => {
    const args = (useFast && step.fastArgs) ? step.fastArgs : step.args;
    const prefix = useFast ? 'mcp__fast-playwright__' : 'mcp__playwright__';
    
    console.log(`\n${index + 1}. ${prefix}${step.tool}`);
    if (Object.keys(args).length > 0) {
      console.log(`   Arguments: ${JSON.stringify(args, null, 2)}`);
    }
  });
  
  console.log(`\nWhen ready, start timer and execute these commands.`);
  console.log(`Then paste the FULL response text when prompted.`);
}

/**
 * Interactive benchmark runner
 */
export async function runBenchmark() {
  console.log("Starting benchmark suite...\n");
  
  for (const scenario of scenarios) {
    const result = { name: scenario.name, description: scenario.description };
    
    // Skip fast-only scenarios for original
    if (!scenario.fastOnly) {
      console.log("\n" + "=".repeat(50));
      console.log("ORIGINAL PLAYWRIGHT MCP TEST");
      console.log("=".repeat(50));
      
      generateCommands(scenario, false);
      console.log("\nPress Enter when ready to start timer...");
      
      // In a real implementation, you would:
      // 1. Start timer when user presses Enter
      // 2. Execute commands via MCP
      // 3. Capture response
      // 4. Calculate metrics
      
      // For now, provide manual instructions
      console.log("\nAfter execution, you'll need to manually record:");
      console.log("- Total execution time");
      console.log("- Full response text (for size/token calculation)");
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("FAST PLAYWRIGHT MCP TEST");
    console.log("=".repeat(50));
    
    generateCommands(scenario, true);
    console.log("\nPress Enter when ready to start timer...");
    
    // Record results
    results.push(result);
  }
  
  // Generate report
  console.log("\n" + "=".repeat(50));
  console.log("BENCHMARK COMPLETE");
  console.log("=".repeat(50));
  console.log("\nGenerating report...");
  console.log(formatResults(results));
}

// Example of how to use the measurement helper
console.log("\nExample measurement code:");
console.log(`
// Start measurement
const measure = createMeasurement("Basic Navigation", "original");

// ... execute MCP commands ...

// Complete measurement with response
const results = measure.complete(fullResponseText);
`);

console.log("\nTo run the full benchmark suite, call runBenchmark()");
console.log("Or use the measurement helpers to track individual scenarios.");