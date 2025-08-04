# Batch Execution Design

## Overview
Implement functionality to define and execute multiple action steps in batch, reducing token consumption from round-trip communication and improving processing speed.

## Design Principles

### 1. Adding Batch Tool
Add a new tool `browser_batch_execute`:

```typescript
const batchExecuteSchema = z.object({
  steps: z.array(z.object({
    tool: z.string().describe('Tool name to execute'),
    arguments: z.record(z.any()).describe('Arguments for the tool'),
    continueOnError: z.boolean().optional().describe('Continue execution even if this step fails'),
    expectation: z.object({
      includeSnapshot: z.boolean().optional(),
      includeConsole: z.boolean().optional(),
      includeDownloads: z.boolean().optional(),
      snapshotSelector: z.string().optional().describe('CSS selector to limit snapshot scope'),
    }).optional().describe('Expected output configuration for this step')
  })).describe('Array of steps to execute in sequence'),
  stopOnFirstError: z.boolean().optional().default(false).describe('Stop batch execution on first error'),
});
```

### 2. Execution Flow

1. **Validation Phase**: Pre-validate tool names and arguments for all steps
2. **Execution Phase**: Execute each step sequentially
3. **Result Collection Phase**: Collect results from each step and return them together

### 3. Error Handling

- `continueOnError`: Control continuation on error at individual step level
- `stopOnFirstError`: Control batch-level behavior on error
- Clearly report which step failed on error

### 4. Usage Example

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_fill',
      arguments: { element: 'Username field', ref: 'input[name="username"]', value: 'testuser' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_fill',
      arguments: { element: 'Password field', ref: 'input[name="password"]', value: 'password' },
      expectation: { includeSnapshot: false }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'Login button', ref: 'button[type="submit"]' },
      expectation: { includeSnapshot: true, snapshotSelector: '.dashboard' }
    }
  ]
});
```

## Benefits

1. **Token Reduction**: Can skip intermediate step snapshots
2. **Speed Improvement**: Reduced round-trip communication
3. **Flexibility**: Take snapshots only when needed
4. **Error Resilience**: Fine-grained control over error behavior