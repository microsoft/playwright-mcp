# Response Filtering Design

## Overview
Implement functionality to specify expected output when executing tools, excluding unnecessary information to reduce token consumption.

## Design Principles

### 1. Common Expectation Schema
Add a common `expectation` parameter to all tools:

```typescript
const expectationSchema = z.object({
  includeSnapshot: z.boolean().optional().default(true),
  includeConsole: z.boolean().optional().default(true),
  includeDownloads: z.boolean().optional().default(true),
  includeTabs: z.boolean().optional().default(true),
  includeCode: z.boolean().optional().default(true),
  snapshotOptions: z.object({
    selector: z.string().optional().describe('CSS selector to limit snapshot scope'),
    maxLength: z.number().optional().describe('Maximum characters for snapshot'),
    format: z.enum(['aria', 'text', 'html']).optional().default('aria')
  }).optional(),
  consoleOptions: z.object({
    levels: z.array(z.enum(['log', 'warn', 'error', 'info'])).optional(),
    maxMessages: z.number().optional().default(10)
  }).optional(),
  imageOptions: z.object({
    quality: z.number().min(1).max(100).optional().describe('JPEG quality (1-100)'),
    maxWidth: z.number().optional().describe('Maximum width in pixels'),
    maxHeight: z.number().optional().describe('Maximum height in pixels'),
    format: z.enum(['jpeg', 'png', 'webp']).optional()
  }).optional()
}).optional();
```

### 2. Response Class Extension

```typescript
class Response {
  private _expectation: ExpectationOptions;
  
  constructor(context: Context, toolName: string, toolArgs: Record<string, any>, expectation?: ExpectationOptions) {
    // ...
    this._expectation = expectation || defaultExpectation;
  }
  
  async finish() {
    if (this._expectation.includeSnapshot && this._context.currentTab()) {
      const options = this._expectation.snapshotOptions;
      if (options?.selector) {
        // Get partial snapshot based on selector
        this._tabSnapshot = await this._context.currentTabOrDie().capturePartialSnapshot(options.selector);
      } else {
        this._tabSnapshot = await this._context.currentTabOrDie().captureSnapshot();
      }
    }
  }
  
  serialize() {
    const response: string[] = [];
    
    // Build response based on expectations
    if (this._expectation.includeCode && this._code.length) {
      // Include code
    }
    
    if (this._expectation.includeConsole && this._tabSnapshot?.consoleMessages.length) {
      // Include filtered console messages
    }
    
    // Image processing
    if (this._expectation.imageOptions) {
      // Resize/compress images
    }
  }
}
```

### 3. Usage Examples

```javascript
// Request minimal response
await browser_click({
  element: 'Submit button',
  ref: 'button[type="submit"]',
  expectation: {
    includeSnapshot: false,
    includeConsole: false,
    includeCode: false
  }
});

// Request snapshot of specific element only
await browser_fill({
  element: 'Search field',
  ref: 'input[name="search"]',
  value: 'test query',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.search-results',
      maxLength: 500
    }
  }
});

// Request error logs only
await browser_navigate({
  url: 'https://example.com',
  expectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error', 'warn'],
      maxMessages: 5
    }
  }
});
```

## Recommended Default Values

Set appropriate defaults per tool:

- **navigate**: Include snapshot (to confirm page load)
- **click/fill**: Include snapshot (to confirm action result)
- **screenshot**: No snapshot needed (image itself is the result)
- **evaluate**: Focus on console output

## Benefits

1. **Flexible Token Management**: Retrieve only necessary information
2. **Performance Improvement**: Skip unnecessary processing
3. **Backward Compatibility**: Maintain existing behavior with default values
4. **Gradual Optimization**: Fine-tune as needed