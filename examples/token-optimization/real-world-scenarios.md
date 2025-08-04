# Real-World Optimization Scenarios

This document demonstrates token optimization techniques applied to common real-world use cases, showing practical examples of how to achieve significant performance improvements.

## 1. E-commerce Testing Scenarios

### Scenario: Product Search and Purchase Flow

**Challenge**: Testing complete purchase flow generates massive token usage due to product catalogs, reviews, and checkout forms.

```javascript
// ❌ Unoptimized approach - ~15,000-25,000 tokens
async function unoptimizedPurchaseFlow() {
  await browser_navigate({ url: 'https://shop.example.com' });
  await browser_type({ element: 'search', ref: '#search', text: 'running shoes' });
  await browser_press_key({ key: 'Enter' });
  await browser_click({ element: 'first product', ref: '.product:first-child' });
  await browser_click({ element: 'size 10', ref: '[data-size="10"]' });
  await browser_click({ element: 'add to cart', ref: '#add-to-cart' });
  await browser_click({ element: 'checkout', ref: '#checkout' });
  // Each step includes full page snapshot, console, tabs
}

// ✅ Optimized batch approach - ~3,000-5,000 tokens (70-80% reduction)
async function optimizedPurchaseFlow() {
  await browser_batch_execute({
    steps: [
      {
        tool: 'browser_navigate',
        arguments: { url: 'https://shop.example.com' },
        expectation: { includeSnapshot: false }
      },
      {
        tool: 'browser_type',
        arguments: { element: 'search', ref: '#search', text: 'running shoes' },
        expectation: { includeSnapshot: false }
      },
      {
        tool: 'browser_press_key',
        arguments: { key: 'Enter' },
        // Verify search results loaded
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: '.search-results, .product-count',
            maxLength: 1500,
            format: 'text'
          }
        }
      },
      {
        tool: 'browser_click',
        arguments: { element: 'first product', ref: '.product:first-child' },
        expectation: { includeSnapshot: false }
      },
      {
        tool: 'browser_click',
        arguments: { element: 'size 10', ref: '[data-size="10"]' },
        expectation: { includeSnapshot: false }
      },
      {
        tool: 'browser_click',
        arguments: { element: 'add to cart', ref: '#add-to-cart' },
        // Verify item added to cart
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: '.cart-notification, .cart-count',
            maxLength: 500
          }
        }
      },
      {
        tool: 'browser_click',
        arguments: { element: 'checkout', ref: '#checkout' },
        // Verify checkout page loaded
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: '.checkout-form, .order-summary',
            maxLength: 2000
          }
        }
      }
    ],
    globalExpectation: {
      includeConsole: true,
      consoleOptions: {
        levels: ['error'],
        maxMessages: 3
      },
      includeTabs: false,
      includeDownloads: false
    }
  });
}
```

### Scenario: Price Comparison Across Products

```javascript
// Monitor multiple product prices efficiently
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://shop.example.com/search?q=laptops' }
    },
    // Extract price information only
    {
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.product-card .price, .product-card .title',
          format: 'text',
          maxLength: 3000
        }
      }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'next page', ref: '.pagination .next' }
    },
    {
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.product-card .price, .product-card .title',
          format: 'text',
          maxLength: 3000
        }
      }
    }
  ],
  globalExpectation: {
    includeSnapshot: false,
    includeConsole: false,
    includeTabs: false
  }
});
```

## 2. Form Testing and Validation

### Scenario: Multi-Step Registration Form

**Challenge**: Long registration forms with validation feedback create verbose responses.

```javascript
// ✅ Optimized registration testing
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://app.example.com/register' },
      expectation: { includeSnapshot: false }
    },
    // Personal information section
    {
      tool: 'browser_type',
      arguments: { element: 'first name', ref: '#firstName', text: 'John' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'last name', ref: '#lastName', text: 'Doe' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'email', ref: '#email', text: 'john.doe@example.com' },
      expectation: { includeSnapshot: false }
    },
    // Test password validation
    {
      tool: 'browser_type',
      arguments: { element: 'password', ref: '#password', text: 'weak' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.password-strength, .validation-message',
          maxLength: 300
        }
      }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'password', ref: '#password', text: 'StrongP@ssw0rd123' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.password-strength',
          maxLength: 200
        }
      }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'confirm password', ref: '#confirmPassword', text: 'StrongP@ssw0rd123' },
      expectation: { includeSnapshot: false }
    },
    // Submit and verify
    {
      tool: 'browser_click',
      arguments: { element: 'register button', ref: '#register' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.success-message, .error-message, .validation-errors',
          maxLength: 1000
        }
      }
    }
  ],
  globalExpectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error', 'warn'],
      patterns: ['^Validation', '^Form'],
      maxMessages: 5
    },
    includeTabs: false
  }
});
```

### Scenario: Dynamic Form Fields

```javascript
// Handle forms with conditional fields
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_click',
      arguments: { element: 'account type business', ref: '#type-business' },
      // Show additional business fields
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.business-fields, .conditional-fields',
          maxLength: 1500
        }
      }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'company name', ref: '#companyName', text: 'Acme Corp' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'tax id', ref: '#taxId', text: '123-45-6789' },
      expectation: { includeSnapshot: false }
    },
    // Verify all required fields completed
    {
      tool: 'browser_click',
      arguments: { element: 'validate form', ref: '#validate' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.form-status, .required-fields, .validation-summary',
          maxLength: 800
        }
      }
    }
  ]
});
```

## 3. Dashboard and Analytics Monitoring

### Scenario: Multi-Dashboard Data Collection

**Challenge**: Corporate dashboards with charts, tables, and widgets generate enormous snapshots.

```javascript
// ✅ Selective dashboard monitoring
async function monitorDashboards() {
  const dashboards = [
    { name: 'sales', selector: '.sales-metrics, .revenue-chart' },
    { name: 'traffic', selector: '.traffic-stats, .visitor-count' },
    { name: 'conversion', selector: '.conversion-rate, .funnel-chart' }
  ];

  for (const dashboard of dashboards) {
    await browser_batch_execute({
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: `https://analytics.example.com/${dashboard.name}` },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_wait_for',
          arguments: { text: 'Data loaded' },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_snapshot',
          arguments: {},
          expectation: {
            includeSnapshot: true,
            snapshotOptions: {
              selector: dashboard.selector,
              format: 'text',
              maxLength: 2000
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
  }
}
```

### Scenario: Real-time Data Monitoring

```javascript
// Monitor live data with minimal overhead
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://monitoring.example.com/live' }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'refresh data', ref: '#refresh' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_wait_for',
      arguments: { time: 3 },
      expectation: { includeSnapshot: false }
    },
    // Capture only critical metrics
    {
      tool: 'browser_snapshot',
      arguments: {},
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.critical-alerts, .system-status, .key-metrics',
          format: 'text',
          maxLength: 1200
        }
      }
    }
  ],
  globalExpectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error'],
      patterns: ['^System', '^Critical'],
      maxMessages: 3
    }
  }
});
```

## 4. Content Management Systems

### Scenario: Blog Post Creation and Publishing

```javascript
// ✅ Optimized content creation workflow
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://cms.example.com/posts/new' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'title', ref: '#post-title', text: 'New Blog Post' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { 
        element: 'content', 
        ref: '#post-content', 
        text: 'This is the blog post content...' 
      },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'add image', ref: '#add-image' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_file_upload',
      arguments: { paths: ['/path/to/image.jpg'] },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.image-preview, .upload-status',
          maxLength: 500
        }
      }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'save draft', ref: '#save-draft' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.save-status, .draft-indicator',
          maxLength: 300
        }
      }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'publish', ref: '#publish' },
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.publish-status, .success-message',
          maxLength: 400
        }
      }
    }
  ],
  globalExpectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error'],
      patterns: ['^Upload', '^Save', '^Publish'],
      maxMessages: 5
    }
  }
});
```

## 5. API Testing Through UI

### Scenario: Testing API Responses via Web Interface

```javascript
// ✅ Efficient API testing through UI
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://api-console.example.com' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'new request', ref: '#new-request' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_select_option',
      arguments: { element: 'method', ref: '#method', values: ['POST'] },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { 
        element: 'url', 
        ref: '#api-url', 
        text: '/api/v1/users' 
      },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_type',
      arguments: { 
        element: 'body', 
        ref: '#request-body', 
        text: '{"name": "Test User", "email": "test@example.com"}' 
      },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'send request', ref: '#send' },
      // Capture response only
      expectation: {
        includeSnapshot: true,
        snapshotOptions: {
          selector: '.response-body, .response-headers, .status-code',
          format: 'text',
          maxLength: 2000
        }
      }
    }
  ],
  globalExpectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error'],
      patterns: ['^API', '^Network'],
      maxMessages: 5
    }
  }
});
```

## 6. Cross-Browser Testing Optimization

### Scenario: Feature Testing Across Different Viewports

```javascript
// ✅ Responsive testing with minimal overhead
const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 667, name: 'mobile' }
];

for (const viewport of viewports) {
  await browser_batch_execute({
    steps: [
      {
        tool: 'browser_resize',
        arguments: { width: viewport.width, height: viewport.height },
        expectation: { includeSnapshot: false }
      },
      {
        tool: 'browser_navigate',
        arguments: { url: 'https://responsive.example.com' },
        expectation: { includeSnapshot: false }
      },
      {
        tool: 'browser_wait_for',
        arguments: { time: 2 },
        expectation: { includeSnapshot: false }
      },
      // Capture layout for comparison
      {
        tool: 'browser_snapshot',
        arguments: {},
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: '.main-content, .navigation, .sidebar',
            format: 'text',
            maxLength: 1500
          }
        }
      },
      // Test mobile menu if mobile viewport
      ...(viewport.name === 'mobile' ? [{
        tool: 'browser_click',
        arguments: { element: 'menu toggle', ref: '#menu-toggle' },
        expectation: {
          includeSnapshot: true,
          snapshotOptions: {
            selector: '.mobile-menu',
            maxLength: 800
          }
        }
      }] : [])
    ],
    globalExpectation: {
      includeConsole: false,
      includeTabs: false
    }
  });
}
```

## 7. Performance Testing Scenarios

### Scenario: Page Load Performance Monitoring

```javascript
// ✅ Monitor performance metrics with focused output
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://performance-test.example.com' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_wait_for',
      arguments: { time: 5 },
      expectation: { includeSnapshot: false }
    },
    // Extract performance metrics via JavaScript
    {
      tool: 'browser_evaluate',
      arguments: {
        function: `() => {
          const perf = performance.getEntriesByType('navigation')[0];
          return {
            loadTime: perf.loadEventEnd - perf.loadEventStart,
            domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
            resourceCount: performance.getEntriesByType('resource').length
          };
        }`
      },
      expectation: {
        includeConsole: true,
        consoleOptions: {
          levels: ['log'],
          maxMessages: 5
        }
      }
    }
  ],
  globalExpectation: {
    includeSnapshot: false,
    includeTabs: false,
    includeDownloads: false
  }
});
```

## Key Optimization Strategies Summary

### 1. Selective Verification
- Only capture snapshots at verification points
- Use CSS selectors to focus on relevant content
- Skip intermediate steps that don't need validation

### 2. Batch Related Operations
- Group 3-7 related steps in a single batch
- Use global expectations for common settings  
- Override expectations only when needed

### 3. Smart Console Filtering
- Filter by log levels and patterns
- Remove duplicate messages
- Limit message count to essentials

### 4. Progressive Enhancement
- Start with basic optimization (no snapshots)
- Add selective snapshots where needed
- Fine-tune based on actual usage patterns

### 5. Context-Aware Defaults
- Navigation: Full context for verification
- Form filling: Validation feedback only
- Data extraction: Targeted content only
- Testing: Error monitoring focused

These patterns can achieve 60-85% token reduction while maintaining full functionality and improving execution speed by 2-5x.