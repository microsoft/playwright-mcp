# Token Optimization Examples

This directory contains comprehensive examples and guides for optimizing token usage and performance with the Playwright MCP server's advanced features.

## 📁 Files Overview

### [basic-optimization.md](./basic-optimization.md)
Fundamental token optimization techniques covering:
- Response filtering with expectation parameters
- Selective snapshot capturing
- Console message filtering
- Progressive optimization strategies
- Token counting and measurement approaches

**Best for**: Getting started with optimization, understanding core concepts

### [batch-execution.md](./batch-execution.md)
Complete guide to batch execution for performance improvements:
- Basic batch workflows
- Advanced configuration options
- Error handling strategies
- Complex multi-step scenarios
- Performance optimization patterns

**Best for**: Multi-step workflows, reducing latency, automation sequences

### [real-world-scenarios.md](./real-world-scenarios.md)
Practical optimization examples for common use cases:
- E-commerce testing workflows
- Form validation and testing
- Dashboard and analytics monitoring
- Content management systems
- API testing through UI
- Cross-browser and performance testing

**Best for**: Applying optimization to specific industry scenarios

## 🚀 Quick Start

### 1. Basic Optimization (5 minutes)
Start with simple expectation parameters:

```javascript
// Instead of this:
await browser_navigate({ url: 'https://example.com' });

// Use this for 80% token reduction:
await browser_navigate({ 
  url: 'https://example.com',
  expectation: { includeSnapshot: false, includeConsole: false }
});
```

### 2. Batch Execution (10 minutes)
Convert multi-step workflows:

```javascript
// Instead of multiple individual calls:
await browser_navigate({ url: 'https://example.com' });
await browser_type({ element: 'search', ref: '#search', text: 'query' });
await browser_click({ element: 'button', ref: '#submit' });

// Use batch execution for 3x speed improvement:
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://example.com' } },
    { tool: 'browser_type', arguments: { element: 'search', ref: '#search', text: 'query' } },
    { tool: 'browser_click', arguments: { element: 'button', ref: '#submit' } }
  ]
});
```

### 3. Advanced Optimization (30 minutes)
Combine techniques for maximum efficiency:

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com' },
      expectation: { includeSnapshot: false }  # Skip intermediate snapshots
    },
    {
      tool: 'browser_click',
      arguments: { element: 'button', ref: '#critical' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { 
          selector: '.results',  # Only capture relevant area
          maxLength: 1000        # Limit snapshot size
        }
      }
    }
  ],
  globalExpectation: {
    includeConsole: false,  # Global optimization
    includeTabs: false
  }
});
```

## 📊 Expected Performance Gains

| Optimization Level | Token Reduction | Speed Improvement | Implementation Effort |
|-------------------|----------------|-------------------|---------------------|
| **Basic** | 50-70% | 1.5-2x | Low (5 min) |
| **Selective** | 60-80% | 2-3x | Medium (30 min) |
| **Advanced** | 70-85% | 3-5x | High (2-4 hours) |

## 🎯 Optimization Decision Tree

```
┌─ Single action? ─ Yes ──→ Add expectation parameter
│
├─ 2-3 actions? ── Maybe ─→ Consider batch execution
│
├─ 4+ actions? ─── Yes ──→ Use batch execution
│
└─ Complex flow? ─ Yes ──→ Use batch + selective expectations
```

## 📋 Use Case Index

### By Industry/Domain
- **E-commerce**: [real-world-scenarios.md#e-commerce-testing-scenarios](./real-world-scenarios.md#1-e-commerce-testing-scenarios)
- **Forms/Validation**: [real-world-scenarios.md#form-testing-and-validation](./real-world-scenarios.md#2-form-testing-and-validation)
- **Analytics/Dashboards**: [real-world-scenarios.md#dashboard-and-analytics-monitoring](./real-world-scenarios.md#3-dashboard-and-analytics-monitoring)
- **Content Management**: [real-world-scenarios.md#content-management-systems](./real-world-scenarios.md#4-content-management-systems)
- **API Testing**: [real-world-scenarios.md#api-testing-through-ui](./real-world-scenarios.md#5-api-testing-through-ui)

### By Technique
- **Response Filtering**: [basic-optimization.md#response-filtering-examples](./basic-optimization.md#1-response-filtering-examples)
- **Selective Snapshots**: [basic-optimization.md#selective-snapshot-examples](./basic-optimization.md#2-selective-snapshot-examples)
- **Console Filtering**: [basic-optimization.md#console-message-filtering](./basic-optimization.md#3-console-message-filtering)
- **Batch Execution**: [batch-execution.md#basic-batch-execution](./batch-execution.md#1-basic-batch-execution)
- **Error Handling**: [batch-execution.md#advanced-batch-configuration](./batch-execution.md#2-advanced-batch-configuration)

### By Complexity
- **Beginner**: [basic-optimization.md](./basic-optimization.md)
- **Intermediate**: [batch-execution.md](./batch-execution.md)
- **Advanced**: [real-world-scenarios.md](./real-world-scenarios.md)

## 🛠️ Tools and Utilities

### Token Measurement
```javascript
// Rough token estimation helper
function estimateTokens(response) {
  return Math.ceil(response.length / 4);
}

// Before/after comparison
const before = await browser_navigate({ url: 'https://example.com' });
const after = await browser_navigate({ 
  url: 'https://example.com', 
  expectation: { includeSnapshot: false } 
});

console.log(`Reduction: ${((estimateTokens(before) - estimateTokens(after)) / estimateTokens(before) * 100).toFixed(1)}%`);
```

### Performance Benchmarking
```javascript
// Execution time comparison
const start = Date.now();
await browser_batch_execute({ /* your batch */ });
const duration = Date.now() - start;
console.log(`Batch execution: ${duration}ms`);
```

## 📚 Additional Resources

### Related Documentation
- [Main README](../../README.md#token-optimization-features) - Overview of token optimization features
- [Performance Guide](../../docs/performance-guide.md) - Detailed performance optimization guide
- [API Reference](../../docs/token-optimization-design.md) - Complete technical specification

### Community Examples
- Share your optimization patterns by contributing to this directory
- Report performance improvements and real-world results
- Suggest new scenarios and use cases

## 🤝 Contributing

Found a great optimization pattern? Help others by:

1. Adding your scenario to [real-world-scenarios.md](./real-world-scenarios.md)
2. Creating new example files for specific domains
3. Sharing performance measurements and results
4. Suggesting improvements to existing examples

## ⚡ Quick Reference

### Most Effective Optimizations
1. **Disable snapshots for intermediate steps** - 60-80% token reduction
2. **Use CSS selectors for large pages** - 70-90% snapshot size reduction  
3. **Batch 3+ sequential operations** - 2-5x speed improvement
4. **Filter console to errors only** - 50-80% console size reduction
5. **Combine global + step expectations** - Fine-grained control

### Common Patterns
```javascript
// Navigation chain - minimal output
expectation: { includeSnapshot: false, includeConsole: false }

// Form submission - validation feedback only  
expectation: { 
  includeSnapshot: true,
  snapshotOptions: { selector: '.errors, .success' }
}

// Data extraction - content only
expectation: {
  includeSnapshot: true,
  snapshotOptions: { selector: '.data-table', format: 'text', maxLength: 2000 }
}

// Debugging - full context
expectation: {
  includeSnapshot: true,
  includeConsole: true,
  consoleOptions: { levels: ['log', 'warn', 'error'] }
}
```

Start with these patterns and customize based on your specific needs!