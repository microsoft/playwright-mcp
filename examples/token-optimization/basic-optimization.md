# Basic Token Optimization Examples

This document demonstrates fundamental token optimization techniques using the Playwright MCP server's expectation parameter and batch execution features.

## 1. Response Filtering Examples

### Standard vs Optimized Navigation

```javascript
// ❌ Standard navigation - includes full page context
await browser_navigate({ 
  url: 'https://example.com' 
});
// Response includes: full page snapshot, console messages, tab info, downloads
// Estimated tokens: ~2000-5000

// ✅ Optimized navigation - minimal output for simple navigation
await browser_navigate({ 
  url: 'https://example.com',
  expectation: {
    includeSnapshot: false,
    includeConsole: false,
    includeTabs: false,
    includeDownloads: false
  }
});
// Response includes: navigation confirmation only
// Estimated tokens: ~50-100 (95% reduction)
```

### Intermediate vs Final Step Optimization

```javascript
// Form filling workflow - optimize intermediate steps
async function loginWorkflow() {
  // Step 1: Navigate (no verification needed)
  await browser_navigate({
    url: 'https://app.example.com/login',
    expectation: { includeSnapshot: false, includeConsole: false }
  });

  // Step 2: Fill username (no verification needed)
  await browser_type({
    element: 'Username field',
    ref: '#username',
    text: 'testuser',
    expectation: { includeSnapshot: false }
  });

  // Step 3: Fill password (no verification needed)
  await browser_type({
    element: 'Password field', 
    ref: '#password',
    text: 'password',
    expectation: { includeSnapshot: false }
  });

  // Step 4: Submit and verify (full context needed)
  await browser_click({
    element: 'Login button',
    ref: '#login-btn',
    expectation: {
      includeSnapshot: true,
      snapshotOptions: {
        selector: '.dashboard, .error-message', // Only relevant areas
        maxLength: 1500
      },
      includeConsole: true,
      consoleOptions: {
        levels: ['error', 'warn'],
        maxMessages: 5
      }
    }
  });
}
```

## 2. Selective Snapshot Examples

### Large Page Optimization

```javascript
// ❌ Full page snapshot for large e-commerce site
await browser_click({
  element: 'Add to cart button',
  ref: '#add-to-cart'
});
// Captures entire page including header, footer, sidebar, product listings
// Estimated tokens: ~8000-15000

// ✅ Targeted snapshot - only cart area
await browser_click({
  element: 'Add to cart button',
  ref: '#add-to-cart',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.cart-summary, .notification',
      maxLength: 1000,
      format: 'text'  // More compact than aria
    },
    includeConsole: false,
    includeTabs: false
  }
});
// Captures only cart-related elements
// Estimated tokens: ~200-500 (90% reduction)
```

### Multi-Section Page Navigation

```javascript
// Dashboard with multiple sections - focus on relevant area
await browser_click({
  element: 'Analytics tab',
  ref: '#analytics-tab',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.analytics-panel, .tab-navigation',
      maxLength: 2000
    },
    includeConsole: true,
    consoleOptions: {
      levels: ['error'],  // Only critical errors
      maxMessages: 3
    }
  }
});
```

## 3. Console Message Filtering

### Development vs Production Filtering

```javascript
// Development environment - detailed logging
await browser_navigate({
  url: 'https://dev.example.com',
  expectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['log', 'warn', 'error', 'info'],
      maxMessages: 20,
      removeDuplicates: true
    }
  }
});

// Production environment - errors only
await browser_navigate({
  url: 'https://example.com',
  expectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error'],
      maxMessages: 5,
      patterns: ['^(Error|Critical)'],  // Only critical messages
      removeDuplicates: true
    }
  }
});
```

### Testing Environment Optimization

```javascript
// Testing with specific error monitoring
await browser_click({
  element: 'Submit form',
  ref: '#submit-form',
  expectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error', 'warn'],
      patterns: [
        '^ValidationError',
        '^NetworkError', 
        '^AuthError'
      ],
      maxMessages: 10
    },
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.form-errors, .success-message'
    }
  }
});
```

## 4. Progressive Optimization Strategy

### Phase 1: Basic Optimization (Easy wins)
```javascript
// Start by removing snapshots from intermediate steps
const steps = [
  // Navigation - no snapshot needed
  { includeSnapshot: false },
  
  // Form filling - no snapshot needed
  { includeSnapshot: false },
  
  // Final submission - snapshot needed
  { includeSnapshot: true }
];
```

### Phase 2: Selective Information (Medium effort)
```javascript
// Add console filtering and tab management
const optimizedExpectation = {
  includeSnapshot: true,
  snapshotOptions: { selector: '.main-content' },
  includeConsole: true,
  consoleOptions: { levels: ['error', 'warn'], maxMessages: 5 },
  includeTabs: false,
  includeDownloads: false
};
```

### Phase 3: Advanced Tuning (High precision)
```javascript
// Fine-tune based on specific use cases and page characteristics
const advancedExpectation = {
  includeSnapshot: true,
  snapshotOptions: {
    selector: '.result-panel, .notification-area',
    maxLength: 800,
    format: 'text'
  },
  includeConsole: true,
  consoleOptions: {
    levels: ['error'],
    patterns: ['^(?!.*third-party).*Error'],  // Exclude third-party errors
    maxMessages: 3,
    removeDuplicates: true
  },
  includeTabs: false,
  includeDownloads: false,
  includeCode: false  // Remove if code visibility not needed
};
```

## 5. Measuring Optimization Impact

### Token Counting Approach
```javascript
// Helper function to estimate token count (approximate)
function estimateTokens(response) {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(response.length / 4);
}

// Before optimization
const standardResponse = await browser_navigate({ url: 'https://example.com' });
const beforeTokens = estimateTokens(standardResponse);

// After optimization  
const optimizedResponse = await browser_navigate({
  url: 'https://example.com',
  expectation: { includeSnapshot: false, includeConsole: false }
});
const afterTokens = estimateTokens(optimizedResponse);

console.log(`Token reduction: ${((beforeTokens - afterTokens) / beforeTokens * 100).toFixed(1)}%`);
```

### Performance Benchmarking
```javascript
// Measure execution time
const startTime = Date.now();

await browser_navigate({
  url: 'https://example.com',
  expectation: { includeSnapshot: false }
});

const executionTime = Date.now() - startTime;
console.log(`Execution time: ${executionTime}ms`);
```

## 6. Common Optimization Patterns

### Pattern 1: Navigation Chain
```javascript
// Multi-page navigation with minimal intermediate output
const pages = ['page1', 'page2', 'page3', 'final'];
for (let i = 0; i < pages.length; i++) {
  const isLastPage = i === pages.length - 1;
  
  await browser_navigate({
    url: `https://example.com/${pages[i]}`,
    expectation: {
      includeSnapshot: isLastPage,  // Only capture final page
      includeConsole: isLastPage,
      includeTabs: false,
      includeDownloads: false
    }
  });
}
```

### Pattern 2: Form Validation Loop
```javascript
// Form submission with error handling
await browser_click({
  element: 'Submit button',
  ref: '#submit',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.validation-errors, .success-message',
      maxLength: 1000
    },
    includeConsole: true,
    consoleOptions: {
      levels: ['error'],
      patterns: ['^Validation'],
      maxMessages: 5
    }
  }
});
```

### Pattern 3: Search and Filter
```javascript
// Search results with focused output
await browser_type({
  element: 'Search box',
  ref: '#search',
  text: 'optimization techniques',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.search-results, .result-count',
      maxLength: 2000,
      format: 'text'
    },
    includeConsole: false
  }
});
```

## Key Takeaways

1. **Start simple**: Begin with `includeSnapshot: false` for intermediate steps
2. **Use selectors**: Target specific page areas with CSS selectors
3. **Filter console**: Only include relevant log levels
4. **Measure impact**: Track token reduction and performance gains
5. **Iterate**: Gradually refine expectations based on results
6. **Test thoroughly**: Ensure critical information isn't lost in optimization

This approach can achieve 50-80% token reduction while maintaining functionality.