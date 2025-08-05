# Response Diff Detection - Usage Examples

This document provides practical examples of using the response diff detection feature in fast-playwright-mcp.

## Basic Usage

### Enable Diff Detection

```javascript
await browser_click({
  element: 'Submit button',
  ref: '#submit',
  expectation: {
    includeSnapshot: true,
    diffOptions: {
      enabled: true,
      threshold: 0.1,
      format: 'unified',
      maxDiffLines: 30,
      context: 3
    }
  }
});
```

### Response Output with Diff

When differences are detected, the response will include:

```markdown
### Changes from previous response
Similarity: 75.2%
Changes: 3 additions, 2 deletions

```diff
  Page URL: https://example.com
- Page Title: Loading...
+ Page Title: Form Submitted
  
  Page Snapshot:
- button "Submit" [disabled]
+ text "Thank you for your submission!"
```

### Result
Form submitted successfully.
```

## Different Format Options

### Unified Format (Default)
Shows additions and removals with context lines.

```javascript
diffOptions: {
  enabled: true,
  format: 'unified',
  context: 3
}
```

### Split Format
Shows removals and additions in separate sections.

```javascript
diffOptions: {
  enabled: true,
  format: 'split'
}
```

Output:
```markdown
--- Removed
Old content line 1
Old content line 2

+++ Added
New content line 1
New content line 2
```

### Minimal Format
Shows only the changes without context.

```javascript
diffOptions: {
  enabled: true,
  format: 'minimal'
}
```

## Threshold Control

### Ignore Small Changes
```javascript
diffOptions: {
  enabled: true,
  threshold: 0.9, // Ignore changes < 10%
  format: 'unified'
}
```

### Detect All Changes
```javascript
diffOptions: {
  enabled: true,  
  threshold: 0.0, // Detect any change
  format: 'unified'
}
```

## Batch Execution with Diff Detection

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com/form' },
      expectation: {
        includeSnapshot: true,
        diffOptions: { enabled: true, format: 'unified' }
      }
    },
    {
      tool: 'browser_type',
      arguments: { element: 'Name field', ref: '#name', text: 'John Doe' },
      expectation: {
        includeSnapshot: true,
        diffOptions: { enabled: true, format: 'minimal' }
      }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'Submit button', ref: '#submit' },
      expectation: {
        includeSnapshot: true,
        diffOptions: { enabled: true, format: 'unified', maxDiffLines: 20 }
      }
    }
  ],
  globalExpectation: {
    includeConsole: false,
    includeDownloads: false
  }
});
```

Each step will show differences from its previous execution of the same tool.

## Advanced Configuration

### Custom Diff Limits
```javascript
diffOptions: {
  enabled: true,
  format: 'unified',
  maxDiffLines: 50,     // Limit output to 50 lines
  ignoreWhitespace: true, // Ignore whitespace changes
  context: 5            // Show 5 lines of context
}
```

### Tool-Specific Diff Detection
Different tools maintain separate diff histories:

```javascript
// First click - no diff (first time)
await browser_click({
  element: 'Button A',
  ref: '#btn-a',
  expectation: { diffOptions: { enabled: true } }
});

// Second click - no diff (different element, but same tool type)
await browser_click({
  element: 'Button B', 
  ref: '#btn-b',
  expectation: { diffOptions: { enabled: true } }
});

// Third click - shows diff (compared to previous browser_click)
await browser_click({
  element: 'Button A',
  ref: '#btn-a', 
  expectation: { diffOptions: { enabled: true } }
});
```

## Performance Considerations

### Optimizing for Large Pages
```javascript
diffOptions: {
  enabled: true,
  format: 'minimal',     // Fastest format
  maxDiffLines: 20,      // Limit output size
  threshold: 0.2,        // Ignore minor changes
  ignoreWhitespace: true // Reduce noise
}
```

### Memory Efficient Settings
```javascript
expectation: {
  includeSnapshot: true,
  includeConsole: false,  // Reduce content size
  includeDownloads: false,
  diffOptions: {
    enabled: true,
    format: 'minimal',
    maxDiffLines: 10
  }
}
```

## Error Handling

Diff detection failures are handled gracefully:

```javascript
// If diff detection fails, the response continues normally
await browser_click({
  element: 'Button',
  ref: '#btn',
  expectation: {
    diffOptions: { enabled: true }
  }
});
// No error thrown - diff section simply omitted if detection fails
```

## Use Cases

### Form Filling Progress
Track form state changes as fields are filled:

```javascript
const formSteps = ['#name', '#email', '#phone', '#submit'];
for (const selector of formSteps) {
  await browser_click({
    element: `Field: ${selector}`,
    ref: selector,
    expectation: {
      includeSnapshot: true,
      diffOptions: {
        enabled: true,
        format: 'unified',
        context: 2
      }
    }
  });
}
```

### Page Navigation Monitoring
Monitor page changes during navigation:

```javascript
await browser_navigate({
  url: 'https://example.com/multi-step-process',
  expectation: {
    diffOptions: {
      enabled: true,
      format: 'split',
      threshold: 0.05 // Detect subtle changes
    }
  }
});
```

### Dynamic Content Monitoring
Track dynamic content updates:

```javascript
// Monitor AJAX content updates
await browser_wait_for({
  text: 'Loading complete',
  expectation: {
    includeSnapshot: true,
    diffOptions: {
      enabled: true,
      format: 'unified',
      context: 5
    }
  }
});
```

## Token Usage Optimization

The diff detection feature significantly reduces token usage:

- **Without diff**: Full page content sent each time (~2000 tokens)
- **With diff**: Only changes sent (~200-500 tokens)
- **Token savings**: 70-80% reduction for typical interactions

### Best Practices for Token Efficiency

1. **Enable diff detection for repetitive operations**
2. **Use minimal format for high-frequency actions**
3. **Set appropriate thresholds to ignore noise**
4. **Combine with expectation filters for maximum efficiency**

```javascript
// Optimized for token efficiency
expectation: {
  includeSnapshot: true,
  includeConsole: false,
  includeDownloads: false,
  diffOptions: {
    enabled: true,
    format: 'minimal',
    threshold: 0.1,
    maxDiffLines: 15
  }
}
```