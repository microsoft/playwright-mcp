# Diagnostic System

The Playwright MCP Server includes a comprehensive diagnostic system that helps identify and resolve issues with browser automation. This system provides detailed information about page structure, element discovery, performance metrics, and enhanced error handling.

## Core Components

### 1. PageAnalyzer
Analyzes the current page structure and provides insights about potential automation issues.

#### Features
- **IFrame Detection**: Identifies iframes and their accessibility status
- **Modal State Analysis**: Detects active dialogs and file choosers
- **Element Statistics**: Counts visible and interactable elements
- **Accessibility Metrics**: Identifies elements with missing ARIA attributes
- **Performance Metrics**: Comprehensive DOM complexity, interaction, resource, and layout analysis

#### Usage
```typescript
import { PageAnalyzer } from './src/diagnostics/PageAnalyzer.js';

const analyzer = new PageAnalyzer(page);

// Basic page structure analysis
const analysis = await analyzer.analyzePageStructure();
console.log(`Found ${analysis.iframes.count} iframes`);
console.log(`${analysis.elements.totalInteractable} interactable elements`);

// Performance metrics analysis
const metrics = await analyzer.analyzePerformanceMetrics();
console.log(`DOM elements: ${metrics.domMetrics.totalElements}`);
console.log(`DOM depth: ${metrics.domMetrics.maxDepth}`);
console.log(`Warnings: ${metrics.warnings.length}`);
```

#### Performance Metrics

The `analyzePerformanceMetrics()` method provides comprehensive insights:

**DOM Metrics:**
- Total element count with warning/danger thresholds (1500/3000)
- Maximum DOM depth with thresholds (15/20 levels)
- Large subtree detection (>500 elements)

**Interaction Metrics:**
- Clickable elements count
- Form elements count
- Disabled elements count

**Resource Metrics:**
- Image count and estimated size
- Script tags (inline vs external)
- Stylesheet count

**Layout Metrics:**
- Fixed position elements with purpose detection
- High z-index elements (>1000) with excessive threshold (>9999)
- Overflow hidden element count

**Performance Warnings:**
- Automatic threshold-based warnings
- Categorized by type: dom_complexity, interaction_overload, resource_heavy, layout_issue
- Severity levels: warning, danger

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

### 5. DiagnosticLevel
Controls the level of diagnostic detail provided in responses.

#### Levels
- **none**: No diagnostics (minimal output)
- **basic**: Critical information only (iframes, modals, interactable elements)
- **standard**: Default level with comprehensive analysis
- **detailed**: Includes performance metrics
- **full**: All available information including layout analysis

#### Usage
```typescript
import { DiagnosticLevelManager } from './src/diagnostics/DiagnosticLevel.js';

const manager = new DiagnosticLevelManager();

// Set global diagnostic level
manager.setLevel('detailed');

// Check if a feature should be enabled
if (manager.shouldInclude('performanceMetrics')) {
  // Include performance metrics in output
}

// Get configuration for a specific level
const config = manager.getConfiguration('basic');
```

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
Generate comprehensive diagnostic reports with performance analysis.

```json
{
  "name": "browser_diagnose", 
  "arguments": {
    "searchForElements": {
      "role": "textbox"
    },
    "includePerformanceMetrics": true,
    "includeAccessibilityInfo": true,
    "includeTroubleshootingSuggestions": true,
    "diagnosticLevel": "detailed"
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

### DOM Complexity
- **Total DOM elements:** 2456
- **Max DOM depth:** 18 levels
- **Large subtrees detected:** 2
  1. **ul#large-list**: 600 elements (Large list structure)
  2. **div.container**: 800 elements (Large container element)

### Interaction Elements
- **Clickable elements:** 125
- **Form elements:** 15
- **Disabled elements:** 3

### Resource Load
- **Images:** 24 (Large >1MB estimated)
- **Script tags:** 12 (8 external, 4 inline)
- **Stylesheets:** 5

### Layout Analysis
- **Fixed position elements:** 2
  1. **nav#main-nav**: Fixed navigation element (z-index: 1000)
- **High z-index elements:** 3
  1. **div.modal-overlay**: z-index 9999 (Extremely high z-index - potential issue)
- **Overflow hidden elements:** 8

### Performance Warnings
- ⚠️ **dom_complexity**: High DOM complexity: 2456 elements (threshold: 1500)
- ⚠️ **dom_complexity**: Deep DOM structure: 18 levels (threshold: 15)
- ⚠️ **interaction_overload**: High number of clickable elements: 125 (threshold: 100)

### Browser Performance Timing
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
- **Performance Metrics**: Complete analysis within 1 second
- **Memory Efficient**: Minimal memory footprint during diagnosis
- **Non-blocking**: Diagnostic operations don't interfere with existing automation
- **Cached Results**: Similar analyses are cached to improve performance

### Performance Thresholds (Configuration-Driven System)

The system now uses a centralized configuration-driven threshold management system that eliminates hardcoding and provides runtime configurability:

#### Default Thresholds

| Metric | Warning Level | Danger Level | Description |
|--------|--------------|--------------|-------------|
| DOM Elements | 1500 | 3000 | Total elements in the DOM |
| DOM Depth | 15 | 20 | Maximum nesting level |
| Large Subtree | 500 | - | Elements in a single subtree |
| Clickable Elements | 100 | - | Interactive elements count |
| High Z-Index | 1000 | 9999 | Z-index values |

#### Configuration System Features

- **Centralized Management**: All thresholds managed by `DiagnosticThresholds` class
- **Runtime Configuration**: Thresholds can be updated during runtime without code changes
- **Validation**: Automatic validation of threshold values with meaningful error messages
- **SmartConfig Integration**: Seamless integration with existing configuration system
- **Environment-Specific**: Different threshold profiles for development, production, testing
- **Fallback Support**: Automatic fallback to default values if custom configuration fails

#### Usage Examples

```typescript
import { getCurrentThresholds, DiagnosticThresholds } from './DiagnosticThresholds.js';

// Get current thresholds
const thresholds = getCurrentThresholds();
const domThresholds = thresholds.getDomThresholds();

// Update specific thresholds
thresholds.updateThresholds({
  dom: {
    elementsWarning: 2000,  // Increase warning threshold
    elementsDanger: 4000    // Increase danger threshold
  }
});

// Reset to defaults
thresholds.resetToDefaults();
```

#### Configuration Validation

The system provides comprehensive validation:

```typescript
const diagnostics = getCurrentThresholds().getConfigDiagnostics();
console.log('Status:', diagnostics.status);
console.log('Customizations:', diagnostics.customizations);
console.log('Warnings:', diagnostics.warnings);
```

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
Monitor page complexity and performance characteristics:

```json
{
  "name": "browser_diagnose",
  "arguments": {
    "includePerformanceMetrics": true,
    "diagnosticLevel": "detailed"
  }
}
```

This provides insights into:
- DOM complexity that might slow automation
- Resource load that affects page speed
- Layout issues that could interfere with element interaction
- Automatic warnings when thresholds are exceeded

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
3. **Monitor Performance**: Use performance metrics to identify pages with complexity issues
4. **Handle IFrames**: Pay attention to iframe warnings in diagnostic reports
5. **Consider Accessibility**: Use accessibility info to create more robust selectors
6. **Set Appropriate Diagnostic Levels**: 
   - Use `basic` for quick checks
   - Use `standard` for general debugging
   - Use `detailed` when performance is a concern
   - Use `full` for comprehensive analysis
7. **Watch for Performance Warnings**: Address warnings to prevent automation failures
8. **Analyze Large Subtrees**: Refactor selectors to avoid traversing large DOM sections

## Error Handling Improvements

The diagnostic system enhances all error messages with:
- **Root Cause Analysis**: Why the operation failed
- **Alternative Solutions**: Other ways to achieve the same goal
- **Context Information**: Page state that might affect automation
- **Actionable Suggestions**: Specific steps to resolve the issue

This makes debugging faster and helps create more reliable automation scripts.