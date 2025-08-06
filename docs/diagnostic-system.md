# Diagnostic System

The Playwright MCP Server includes a comprehensive diagnostic system that helps identify and resolve issues with browser automation. This system provides detailed information about page structure, element discovery, and enhanced error handling.

## Core Components

### 1. PageAnalyzer
Analyzes the current page structure and provides insights about potential automation issues.

#### Features
- **IFrame Detection**: Identifies iframes and their accessibility status
- **Modal State Analysis**: Detects active dialogs and file choosers
- **Element Statistics**: Counts visible and interactable elements
- **Accessibility Metrics**: Identifies elements with missing ARIA attributes

#### Usage
```typescript
import { PageAnalyzer } from './src/diagnostics/PageAnalyzer.js';

const analyzer = new PageAnalyzer(page);
const analysis = await analyzer.analyzePageStructure();

console.log(`Found ${analysis.iframes.count} iframes`);
console.log(`${analysis.elements.totalInteractable} interactable elements`);
```

### 2. ElementDiscovery
Finds alternative elements when the original selector fails.

#### Features
- **Multi-criteria Search**: Text content, ARIA roles, tag names, attributes
- **Confidence Scoring**: Ranks alternatives by likelihood of being correct
- **Smart Matching**: Uses Levenshtein distance for text similarity
- **Implicit Role Detection**: Finds elements with implicit ARIA roles

#### Usage
```typescript
import { ElementDiscovery } from './src/diagnostics/ElementDiscovery.js';

const discovery = new ElementDiscovery(page);
const alternatives = await discovery.findAlternativeElements({
  originalSelector: 'button[data-missing="true"]',
  searchCriteria: {
    text: 'Submit',
    role: 'button'
  },
  maxResults: 5
});

alternatives.forEach(alt => {
  console.log(`Found: ${alt.selector} (${alt.confidence * 100}% confidence)`);
});
```

### 3. ErrorEnrichment
Enriches standard errors with diagnostic information and suggestions.

#### Features
- **Alternative Element Suggestions**: Provides selectors for similar elements
- **Context-aware Analysis**: Considers page state when suggesting solutions
- **Batch Operation Support**: Special handling for failed batch operations
- **Performance Context**: Includes timing and performance considerations

#### Usage
```typescript
import { ErrorEnrichment } from './src/diagnostics/ErrorEnrichment.js';

const enrichment = new ErrorEnrichment(page);
const enrichedError = await enrichment.enrichElementNotFoundError({
  originalError: new Error('Element not found'),
  selector: 'button[data-missing="true"]',
  searchCriteria: { text: 'Submit', role: 'button' }
});

console.log(enrichedError.message);
enrichedError.suggestions.forEach(suggestion => {
  console.log(`💡 ${suggestion}`);
});
```

### 4. EnhancedErrorHandler
Provides high-level error enhancement with tool-specific optimizations.

#### Features
- **Playwright Error Integration**: Seamlessly handles standard Playwright errors
- **Timeout Analysis**: Specialized handling for timeout errors
- **Context Detection**: Identifies frame context issues
- **Performance Monitoring**: Tracks operation performance
- **Tool-specific Suggestions**: Provides suggestions based on the tool being used

## New MCP Tools

### browser_find_elements
Find elements using multiple search criteria.

```json
{
  "name": "browser_find_elements",
  "arguments": {
    "searchCriteria": {
      "text": "Submit",
      "role": "button",
      "tagName": "button",
      "attributes": {
        "data-action": "submit"
      }
    },
    "maxResults": 10,
    "includeDiagnosticInfo": true
  }
}
```

**Response Example:**
```
Found 3 elements matching the criteria:

1. Selector: button[data-action="submit"]
   Confidence: 100%
   Reason: attribute match: data-action="submit"

2. Selector: input[type="submit"]
   Confidence: 80%
   Reason: text match: "Submit"

3. Selector: div.submit-btn
   Confidence: 60%
   Reason: role match: "button"

### Diagnostic Information
- Page has 0 iframes detected: false
- Total visible elements: 45
- Total interactable elements: 12
```

### browser_diagnose
Generate comprehensive diagnostic reports.

```json
{
  "name": "browser_diagnose", 
  "arguments": {
    "searchForElements": {
      "role": "textbox"
    },
    "includePerformanceMetrics": true,
    "includeAccessibilityInfo": true,
    "includeTroubleshootingSuggestions": true
  }
}
```

**Response Example:**
```markdown
# Page Diagnostic Report
**URL:** https://example.com
**Title:** Example Form Page

## Page Structure Analysis
- **IFrames:** 1 iframes detected: true
- **Accessible iframes:** 0
- **Inaccessible iframes:** 1

- **Total visible elements:** 87
- **Total interactable elements:** 15
- **Elements missing ARIA:** 3

## Element Search Results
Found 2 matching elements:
1. **input#username** (90% confidence)
   - implicit role match: "textbox" via input[type="text"]
2. **textarea.comments** (60% confidence)
   - implicit role match: "textbox" via textarea

## Performance Metrics
- **Diagnosis execution time:** 45ms
- **DOM Content Loaded:** 234.56ms
- **Load Complete:** 456.78ms
- **First Paint:** 123.45ms
- **First Contentful Paint:** 234.56ms

## Accessibility Information
- **Elements with missing ARIA labels:** 3
- **Heading elements:** 4
- **Landmark elements:** 3
- **Images with alt text:** 8/10

## Troubleshooting Suggestions
- Elements might be inside iframes - use frameLocator() for iframe interactions
- 3 elements lack proper ARIA attributes - consider using text-based selectors

---
*Diagnosis completed in 45ms*
```

## Performance Requirements

The diagnostic system is designed to operate efficiently:

- **Analysis Time**: Page structure analysis completes within 300ms
- **Memory Efficient**: Minimal memory footprint during diagnosis
- **Non-blocking**: Diagnostic operations don't interfere with existing automation
- **Cached Results**: Similar analyses are cached to improve performance

## Integration with Existing Tools

All existing MCP tools automatically benefit from enhanced error handling:

```typescript
// When an element is not found, you get enhanced errors:
const result = await client.callTool({
  name: 'browser_click',
  arguments: {
    element: 'Submit button',
    ref: 'button[data-missing="true"]'
  }
});

// If the element isn't found, the error response includes:
// - Alternative elements that might work
// - Page structure analysis
// - Context-aware suggestions
// - Troubleshooting guidance
```

## Common Use Cases

### 1. Debugging Failed Automation
When automation fails, use `browser_diagnose` to understand the page state:

```json
{
  "name": "browser_diagnose",
  "arguments": {
    "includeTroubleshootingSuggestions": true
  }
}
```

### 2. Finding Alternative Selectors
When your selector doesn't work, use `browser_find_elements`:

```json
{
  "name": "browser_find_elements", 
  "arguments": {
    "searchCriteria": {
      "text": "Login",
      "role": "button"
    }
  }
}
```

### 3. Performance Analysis
Monitor page load performance during automation:

```json
{
  "name": "browser_diagnose",
  "arguments": {
    "includePerformanceMetrics": true
  }
}
```

### 4. Accessibility Auditing
Check accessibility compliance:

```json
{
  "name": "browser_diagnose",
  "arguments": {
    "includeAccessibilityInfo": true
  }
}
```

## Best Practices

1. **Use Diagnostic Tools Proactively**: Run diagnostics before starting complex automation
2. **Leverage Alternative Elements**: When selectors fail, check suggested alternatives
3. **Monitor Performance**: Use performance metrics to identify slow-loading pages
4. **Handle IFrames**: Pay attention to iframe warnings in diagnostic reports
5. **Consider Accessibility**: Use accessibility info to create more robust selectors

## Error Handling Improvements

The diagnostic system enhances all error messages with:
- **Root Cause Analysis**: Why the operation failed
- **Alternative Solutions**: Other ways to achieve the same goal
- **Context Information**: Page state that might affect automation
- **Actionable Suggestions**: Specific steps to resolve the issue

This makes debugging faster and helps create more reliable automation scripts.