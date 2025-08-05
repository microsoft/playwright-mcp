#!/usr/bin/env node

/**
 * Benchmark scenarios for comparing original playwright-mcp vs fast-playwright-mcp
 * 
 * Each scenario will be executed on both MCP servers to measure:
 * - Execution time
 * - Token usage (estimated from response size)
 */

export const scenarios = [
  {
    name: "Basic Navigation",
    description: "Simple page navigation and snapshot",
    steps: [
      { tool: "browser_navigate", args: { url: "https://example.com" } },
      { tool: "browser_snapshot", args: {} }
    ]
  },
  
  {
    name: "Multiple Snapshots",
    description: "Navigate and take 3 snapshots",
    steps: [
      { tool: "browser_navigate", args: { url: "https://www.google.com" } },
      { tool: "browser_snapshot", args: {} },
      { tool: "browser_click", args: { element: "Gmail link", ref: "e12" } },
      { tool: "browser_snapshot", args: {} },
      { tool: "browser_navigate_back", args: {} },
      { tool: "browser_snapshot", args: {} }
    ]
  },
  
  {
    name: "Screenshot Heavy",
    description: "Multiple screenshots with different options",
    steps: [
      { tool: "browser_navigate", args: { url: "https://github.com" } },
      { tool: "browser_take_screenshot", args: {} },
      { tool: "browser_take_screenshot", args: { fullPage: true } },
      { tool: "browser_navigate", args: { url: "https://example.com" } },
      { tool: "browser_take_screenshot", args: {} }
    ]
  },
  
  {
    name: "Form Interaction",
    description: "Fill form and interact with elements",
    steps: [
      { tool: "browser_navigate", args: { url: "https://www.google.com" } },
      { tool: "browser_type", args: { element: "search input", ref: "e52", text: "playwright testing" } },
      { tool: "browser_snapshot", args: {} },
      { tool: "browser_press_key", args: { key: "Enter" } },
      { tool: "browser_wait_for", args: { time: 2 } },
      { tool: "browser_snapshot", args: {} }
    ]
  },
  
  {
    name: "Batch vs Sequential Execution",
    description: "Compare batch execution with sequential commands",
    steps: [
      // Original: Execute commands one by one
      { tool: "browser_navigate", args: { url: "https://example.com" } },
      { tool: "browser_click", args: { element: "More information link", ref: "e6" } },
      { tool: "browser_wait_for", args: { time: 1 } },
      { tool: "browser_navigate_back", args: {} },
      { tool: "browser_snapshot", args: {} }
    ],
    // Fast: Same operations in batch
    fastSteps: [
      {
        tool: "browser_batch_execute",
        args: {
          globalExpectation: { includeSnapshot: false, includeConsole: false },
          steps: [
            { tool: "browser_navigate", arguments: { url: "https://example.com" } },
            { tool: "browser_click", arguments: { element: "More information link", ref: "e6" } },
            { tool: "browser_wait_for", arguments: { time: 1 } },
            { tool: "browser_navigate_back", arguments: {} }
          ]
        }
      },
      { tool: "browser_snapshot", args: {} }
    ]
  },
  
  {
    name: "Token Optimization Test",
    description: "Test with partial snapshots and image compression",
    steps: [
      { tool: "browser_navigate", args: { url: "https://github.com" } },
      
      // Original: full snapshot
      // Fast: partial snapshot with main content only
      { 
        tool: "browser_snapshot", 
        args: {},
        fastArgs: {
          expectation: {
            snapshotOptions: {
              selector: "main",
              maxLength: 500
            }
          }
        }
      },
      
      // Original: full quality screenshot
      // Fast: compressed JPEG
      { 
        tool: "browser_take_screenshot", 
        args: {},
        fastArgs: {
          expectation: {
            imageOptions: {
              format: "jpeg",
              quality: 50,
              maxWidth: 400
            }
          }
        }
      }
    ]
  }
];

/**
 * Estimate token count from text (rough approximation)
 * OpenAI's rule of thumb: ~4 characters per token
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Format benchmark results
 */
export function formatResults(results) {
  const output = [];
  output.push("# Playwright MCP Benchmark Results\n");
  output.push(`Date: ${new Date().toISOString()}\n`);
  
  for (const scenario of results) {
    output.push(`## ${scenario.name}`);
    output.push(`${scenario.description}\n`);
    
    if (scenario.original) {
      output.push("### Original Playwright MCP");
      output.push(`- Time: ${scenario.original.time}ms`);
      output.push(`- Tokens: ~${scenario.original.tokens}`);
      output.push(`- Response size: ${scenario.original.size} bytes`);
    }
    
    if (scenario.fast) {
      output.push("\n### Fast Playwright MCP");
      output.push(`- Time: ${scenario.fast.time}ms`);
      output.push(`- Tokens: ~${scenario.fast.tokens}`);
      output.push(`- Response size: ${scenario.fast.size} bytes`);
      
      if (scenario.original) {
        const timeSaving = ((1 - scenario.fast.time / scenario.original.time) * 100).toFixed(1);
        const tokenSaving = ((1 - scenario.fast.tokens / scenario.original.tokens) * 100).toFixed(1);
        const sizeSaving = ((1 - scenario.fast.size / scenario.original.size) * 100).toFixed(1);
        
        output.push("\n### Improvements");
        output.push(`- Time: ${timeSaving}% faster`);
        output.push(`- Tokens: ${tokenSaving}% reduction`);
        output.push(`- Size: ${sizeSaving}% smaller`);
      }
    }
    
    output.push("\n---\n");
  }
  
  // Summary
  if (results.some(r => r.original && r.fast)) {
    output.push("## Summary");
    
    const avgTimeImprovement = results
      .filter(r => r.original && r.fast)
      .map(r => (1 - r.fast.time / r.original.time) * 100)
      .reduce((a, b) => a + b, 0) / results.filter(r => r.original && r.fast).length;
    
    const avgTokenImprovement = results
      .filter(r => r.original && r.fast)
      .map(r => (1 - r.fast.tokens / r.original.tokens) * 100)
      .reduce((a, b) => a + b, 0) / results.filter(r => r.original && r.fast).length;
    
    output.push(`- Average time improvement: ${avgTimeImprovement.toFixed(1)}%`);
    output.push(`- Average token reduction: ${avgTokenImprovement.toFixed(1)}%`);
  }
  
  return output.join("\n");
}