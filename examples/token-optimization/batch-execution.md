# Batch Execution Examples

This document demonstrates how to use the `browser_batch_execute` tool to perform multiple browser actions in a single request, dramatically improving performance and reducing token usage.

## 1. Basic Batch Execution

### Simple Login Workflow

```javascript
// ❌ Traditional approach - 4 separate requests
await browser_navigate({ url: 'https://app.example.com/login' });
await browser_type({ element: 'username', ref: '#username', text: 'testuser' });
await browser_type({ element: 'password', ref: '#password', text: 'password' });
await browser_click({ element: 'login button', ref: '#login-btn' });
// 4 round trips, high latency, full context for each step

// ✅ Batch approach - 1 request with optimized responses
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://app.example.com/login' }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'username', ref: '#username', text: 'testuser' }
    },
    {
      tool: 'browser_type', 
      arguments: { element: 'password', ref: '#password', text: 'password' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'login button', ref: '#login-btn' }
    }
  ]
});
// 1 round trip, reduced latency, automatic optimization
```

### E-commerce Product Purchase

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://shop.example.com/product/123' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'size selector', ref: '#size-large' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'color selector', ref: '#color-blue' }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'quantity', ref: '#quantity', text: '2' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'add to cart', ref: '#add-to-cart' }
    }
  ]
});
```

## 2. Advanced Batch Configuration

### Batch with Global Expectations

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com/form' }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'name field', ref: '#name', text: 'John Doe' }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'email field', ref: '#email', text: 'john@example.com' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'submit button', ref: '#submit' },
      // Override global expectation for final step
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { selector: '.success-message, .error-message' }
      }
    }
  ],
  // Apply to all steps unless overridden
  globalExpectation: {
    includeSnapshot: false,
    includeConsole: false,
    includeTabs: false
  }
});
```

### Error Handling Strategies

```javascript
// Strategy 1: Stop on first error (default)
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://example.com' } },
    { tool: 'browser_click', arguments: { element: 'button', ref: '#might-fail' } },
    { tool: 'browser_type', arguments: { element: 'input', ref: '#text', text: 'data' } }
  ],
  stopOnFirstError: true  // Stops at step 2 if it fails
});

// Strategy 2: Continue on errors
await browser_batch_execute({
  steps: [
    { 
      tool: 'browser_navigate', 
      arguments: { url: 'https://example.com' }
    },
    { 
      tool: 'browser_click', 
      arguments: { element: 'optional button', ref: '#optional' },
      continueOnError: true  // This step can fail
    },
    { 
      tool: 'browser_type', 
      arguments: { element: 'required input', ref: '#required', text: 'important' }
    }
  ],
  stopOnFirstError: false  // Process all steps
});

// Strategy 3: Mixed approach
await browser_batch_execute({
  steps: [
    { 
      tool: 'browser_navigate', 
      arguments: { url: 'https://example.com' }
      // Critical step - will stop batch if fails
    },
    { 
      tool: 'browser_click', 
      arguments: { element: 'popup close', ref: '#popup-close' },
      continueOnError: true  // Optional - popup might not exist
    },
    { 
      tool: 'browser_click', 
      arguments: { element: 'consent banner', ref: '#accept-cookies' },
      continueOnError: true  // Optional - banner might not exist
    },
    { 
      tool: 'browser_type', 
      arguments: { element: 'search box', ref: '#search', text: 'products' }
      // Critical step - will stop batch if fails
    }
  ]
});
```

## 3. Complex Workflow Examples

### Data Extraction Workflow

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://data.example.com/reports' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'date filter', ref: '#date-filter' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'last month', ref: '#last-month' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'apply filter', ref: '#apply-filter' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_wait_for',
      arguments: { text: 'Report generated' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.report-data, .summary-stats',
          format: 'text',
          maxLength: 5000
        }
      }
    }
  ],
  globalExpectation: {
    includeConsole: false,
    includeTabs: false,
    includeDownloads: false
  }
});
```

### Multi-Page Data Collection

```javascript
const pages = ['analytics', 'reports', 'settings'];
const batchSteps = [];

// Build steps dynamically
for (const page of pages) {
  batchSteps.push(
    {
      tool: 'browser_navigate',
      arguments: { url: `https://app.example.com/${page}` },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_wait_for',
      arguments: { time: 2 },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.main-content',
          maxLength: 2000
        }
      }
    }
  );
}

await browser_batch_execute({
  steps: batchSteps,
  globalExpectation: {
    includeConsole: false,
    includeTabs: false
  }
});
```

### Form Validation Testing

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://forms.example.com/contact' }
    },
    // Test empty form submission
    {
      tool: 'browser_click',
      arguments: { element: 'submit button', ref: '#submit' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { selector: '.validation-errors' }
      },
      continueOnError: true
    },
    // Fill required fields
    {
      tool: 'browser_type',
      arguments: { element: 'name', ref: '#name', text: 'Test User' }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'email', ref: '#email', text: 'invalid-email' }
    },
    // Test invalid email
    {
      tool: 'browser_click',
      arguments: { element: 'submit button', ref: '#submit' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { selector: '.validation-errors' }
      },
      continueOnError: true
    },
    // Fix email and submit
    {
      tool: 'browser_type',
      arguments: { element: 'email', ref: '#email', text: 'test@example.com' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'submit button', ref: '#submit' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { selector: '.success-message, .error-message' }
      }
    }
  ],
  globalExpectation: {
    includeSnapshot: false,
    includeConsole: true,
    consoleOptions: { levels: ['error'], maxMessages: 3 }
  }
});
```

## 4. Performance Optimization Patterns

### Minimal Output Pattern

```javascript
// For workflows where only final result matters
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://example.com' } },
    { tool: 'browser_type', arguments: { element: 'search', ref: '#search', text: 'query' } },
    { tool: 'browser_press_key', arguments: { key: 'Enter' } },
    { tool: 'browser_wait_for', arguments: { text: 'results' } },
    { 
      tool: 'browser_snapshot', 
      arguments: {},
      expectation: { includeSnapshot: true }  // Only final snapshot
    }
  ],
  globalExpectation: {
    includeSnapshot: false,
    includeConsole: false,
    includeTabs: false,
    includeDownloads: false,
    includeCode: false
  }
});
```

### Progress Monitoring Pattern

```javascript
// For long workflows where intermediate feedback is needed
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://app.example.com' } },
    { 
      tool: 'browser_click', 
      arguments: { element: 'start process', ref: '#start' },
      expectation: { 
        includeSnapshot: true,
        snapshotOptions: { selector: '.progress-indicator' }
      }
    },
    { tool: 'browser_wait_for', arguments: { text: '50% complete' } },
    { 
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { selector: '.progress-indicator' }
      }
    },
    { tool: 'browser_wait_for', arguments: { text: 'Complete' } },
    { 
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: { selector: '.results, .final-status' }
      }
    }
  ],
  globalExpectation: {
    includeConsole: false,
    includeTabs: false
  }
});
```

## 5. Debugging and Monitoring

### Debug Mode Batch

```javascript
// Enable detailed logging for troubleshooting
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://example.com' } },
    { tool: 'browser_click', arguments: { element: 'button', ref: '#debug-me' } }
  ],
  globalExpectation: {
    includeSnapshot: true,  // See page state
    includeConsole: true,   // See console output
    consoleOptions: {
      levels: ['log', 'warn', 'error', 'info'],
      maxMessages: 20
    },
    includeTabs: true,      // See tab changes
    includeCode: true       // See executed code
  }
});
```

### Selective Step Monitoring

```javascript
await browser_batch_execute({
  steps: [
    { 
      tool: 'browser_navigate', 
      arguments: { url: 'https://example.com' },
      expectation: { includeSnapshot: false }  // Skip navigation
    },
    { 
      tool: 'browser_click', 
      arguments: { element: 'critical button', ref: '#critical' },
      expectation: { 
        includeSnapshot: true,  // Monitor this step
        includeConsole: true,
        consoleOptions: { levels: ['error'] }
      }
    },
    { 
      tool: 'browser_type', 
      arguments: { element: 'input', ref: '#input', text: 'data' },
      expectation: { includeSnapshot: false }  // Skip typing
    },
    { 
      tool: 'browser_click', 
      arguments: { element: 'submit', ref: '#submit' },
      expectation: { includeSnapshot: true }  // Monitor result
    }
  ]
});
```

## 6. Best Practices for Batch Execution

### 1. Batch Size Optimization
```javascript
// ✅ Good - 3-7 steps per batch
await browser_batch_execute({
  steps: [
    // 5 related steps
  ]
});

// ❌ Avoid - too many steps (>10) in single batch
// ❌ Avoid - too few steps (<3) - use individual calls instead
```

### 2. Error Recovery Patterns
```javascript
// Pattern: Critical path with optional steps
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://example.com' } }, // Critical
    { 
      tool: 'browser_click', 
      arguments: { element: 'dismiss popup', ref: '#popup' },
      continueOnError: true  // Optional
    },
    { 
      tool: 'browser_click',
      arguments: { element: 'accept cookies', ref: '#cookies' },
      continueOnError: true  // Optional
    },
    { tool: 'browser_type', arguments: { element: 'search', ref: '#search', text: 'query' } } // Critical
  ]
});
```

### 3. State Verification Strategy
```javascript
// Verify state only at critical points
await browser_batch_execute({
  steps: [
    { tool: 'browser_navigate', arguments: { url: 'https://example.com' } },
    { tool: 'browser_type', arguments: { element: 'username', ref: '#user', text: 'test' } },
    { tool: 'browser_type', arguments: { element: 'password', ref: '#pass', text: 'pass' } },
    { 
      tool: 'browser_click',
      arguments: { element: 'login', ref: '#login' },
      expectation: { 
        includeSnapshot: true,
        snapshotOptions: { selector: '.dashboard, .error' }
      }
    }
  ],
  globalExpectation: { includeSnapshot: false }
});
```

## Performance Impact Summary

- **Latency Reduction**: 60-80% for multi-step workflows
- **Token Reduction**: 40-70% when combined with expectations
- **Execution Speed**: 2-5x faster for complex sequences
- **Network Efficiency**: Single request vs multiple round trips

Use batch execution for any workflow with 3+ sequential steps to maximize these benefits.