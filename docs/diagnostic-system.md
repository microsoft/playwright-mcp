# Diagnostic System - Complete Architecture

The Playwright MCP Server includes a comprehensive three-phase diagnostic system that provides advanced error handling, performance monitoring, and intelligent automation assistance.

## Architecture Overview

### Phase 1: Foundation Components
- **PageAnalyzer**: Core page structure analysis
- **ElementDiscovery**: Alternative element finding
- **EnhancedErrorHandler**: Error enrichment with suggestions
- **DiagnosticLevel**: Configurable detail levels

### Phase 2: Advanced Analysis
- **ParallelPageAnalyzer**: Concurrent multi-aspect analysis
- **ResourceUsageMonitor**: Memory and CPU tracking
- **FrameReferenceManager**: Advanced iframe management
- **ResourceManager**: Lifecycle management for handles

### Phase 3: Unified System
- **UnifiedDiagnosticSystem**: Orchestrates all components
- **SmartConfig**: Intelligent configuration management
- **DiagnosticThresholds**: Centralized threshold management
- **Token Optimization**: 50-80% response size reduction

## Core Components

### 1. UnifiedDiagnosticSystem (Phase 3)

The central orchestrator that integrates all diagnostic components with enhanced error handling and performance monitoring.

#### Features
- **Singleton Pattern**: One instance per page for resource efficiency
- **Component Orchestration**: Manages all diagnostic subsystems
- **Error Enrichment**: Automatic error enhancement with context
- **Performance Monitoring**: Real-time operation tracking
- **Resource Management**: Automatic cleanup and leak prevention
- **Configuration Runtime**: Dynamic configuration updates

#### Usage
```typescript
import { UnifiedDiagnosticSystem } from './src/diagnostics/UnifiedSystem.js';

// Get singleton instance with optional config overrides
const system = UnifiedDiagnosticSystem.getInstance(page, {
  features: {
    enableParallelAnalysis: true,
    enableResourceLeakDetection: true,
    enableAdvancedElementDiscovery: true
  },
  performance: {
    thresholds: {
      executionTime: {
        pageAnalysis: 500,
        elementDiscovery: 300
      }
    }
  }
});

// Analyze page structure with parallel processing
const result = await system.analyzePageStructure(true);
if (result.success) {
  console.log('Analysis completed in', result.executionTime, 'ms');
  console.log('Memory usage:', result.memoryUsage);
}

// Find alternative elements with enhanced discovery
const alternatives = await system.findAlternativeElements({
  originalSelector: 'button#submit',
  searchCriteria: { text: 'Submit', role: 'button' },
  maxResults: 5
});

// Get system health status
const health = await system.performHealthCheck();
console.log('System status:', health.status);
console.log('Active operations:', health.activeOperations);
```

### 2. ParallelPageAnalyzer (Phase 2)

Performs concurrent analysis of multiple page aspects for improved performance.

#### Features
- **Concurrent Execution**: Analyzes DOM, performance, and resources in parallel
- **Worker Pool Pattern**: Efficient resource utilization
- **Error Isolation**: Individual task failures don't affect others
- **Resource Monitoring**: Tracks memory and CPU usage per task

#### Parallel Analysis Components
- **Structure Analysis**: DOM tree, iframes, modal states
- **Performance Metrics**: DOM complexity, interaction elements, resources
- **Resource Usage**: Memory snapshots, CPU time tracking
- **Frame Management**: Concurrent iframe analysis

```typescript
const parallelAnalyzer = new ParallelPageAnalyzer(page);
const result = await parallelAnalyzer.runParallelAnalysis();

console.log('Parallel execution time:', result.executionTime, 'ms');
console.log('Tasks completed:', result.tasksCompleted);
console.log('Memory peak:', result.resourceUsage.peakMemory);
```

### 3. SmartConfig System

Advanced configuration management with runtime updates and environment-specific profiles.

#### Features
- **Environment Profiles**: Development, production, testing presets
- **Runtime Updates**: Change configuration without restart
- **Threshold Management**: Integrated with DiagnosticThresholds
- **Validation**: Automatic configuration validation
- **Impact Analysis**: Reports configuration change effects

```typescript
import { SmartConfigManager } from './src/diagnostics/SmartConfig.js';

const config = SmartConfigManager.getInstance();

// Configure for specific environment
config.configureForEnvironment('production');

// Update specific thresholds
config.updateThresholds({
  dom: {
    totalElements: 5000,
    maxDepth: 25
  }
});

// Get configuration impact report
const impact = config.getConfigurationImpactReport();
console.log('Active overrides:', impact.activeOverrides);
console.log('Performance risk:', impact.performanceImpact);
```

### 4. ResourceManager

Manages lifecycle of browser handles and prevents memory leaks.

#### Features
- **Automatic Disposal**: Tracks and disposes unused resources
- **Leak Detection**: Identifies potential memory leaks
- **Handle Management**: Smart handle creation and tracking
- **Cleanup Timers**: Automatic resource cleanup

```typescript
import { globalResourceManager } from './src/diagnostics/ResourceManager.js';

// Track a resource
const handleId = globalResourceManager.trackResource(elementHandle, 'dispose');

// Get resource statistics
const stats = globalResourceManager.getResourceStats();
console.log('Active resources:', stats.activeCount);
console.log('Memory usage:', stats.memoryUsage);

// Automatic cleanup happens on timeout
```

## Token Optimization Features

### Expectation Parameters

Control response content to reduce token usage by 50-80%.

```typescript
// Minimal response (maximum token savings)
{
  expectation: {
    includeSnapshot: false,
    includeConsole: false,
    includeNetwork: false,
    includeTabs: false,
    includeCode: false
  }
}

// Selective inclusion
{
  expectation: {
    includeSnapshot: true,  // Only get visual state
    includeConsole: false,
    maxSnapshotHeight: 500  // Limit snapshot size
  }
}
```

### Batch Execution

Execute multiple operations with single response for 60-70% token reduction.

```typescript
{
  "name": "browser_batch_execute",
  "arguments": {
    "steps": [
      { "tool": "browser_navigate", "args": { "url": "https://example.com" }},
      { "tool": "browser_click", "args": { "element": "Login" }},
      { "tool": "browser_type", "args": { "text": "username" }},
      { "tool": "browser_press_key", "args": { "key": "Tab" }},
      { "tool": "browser_type", "args": { "text": "password" }}
    ],
    "globalExpectation": {
      "includeSnapshot": false,
      "includeCode": true
    }
  }
}
```

## Enhanced MCP Tools

### browser_diagnose (Enhanced)

Now includes Phase 2 and Phase 3 capabilities:

```json
{
  "name": "browser_diagnose",
  "arguments": {
    "diagnosticLevel": "detailed",
    "useParallelAnalysis": true,
    "useUnifiedSystem": true,
    "configOverrides": {
      "enableResourceMonitoring": true,
      "performanceThresholds": {
        "pageAnalysis": 1000,
        "elementDiscovery": 500
      }
    },
    "includeSystemStats": true
  }
}
```

**Enhanced Response:**
```markdown
# Unified Diagnostic System Report
**Unified System Status:** Active with enhanced error handling and monitoring
**Configuration:** Custom overrides applied
**Analysis Type:** Enhanced Parallel Analysis (234ms)
**Memory Usage:** 45.67MB

## Applied Configuration Overrides
- **Resource Monitoring: Enabled**
- **Performance Thresholds: Page Analysis: 300ms → 1000ms**

## Unified System Health
- **System Status:** healthy
- **Total Operations:** 1234
- **Success Rate:** 99.8%
- **Active Handles:** 12
- **Total Errors:** 3

### Configuration Impact Analysis
- **Configuration Status:** Custom With Overrides
🟢 **pageAnalysis**: Expected 300ms, Actual 234ms (-22% notable)
🟡 **elementDiscovery**: Expected 200ms, Actual 189ms (-5% normal)

**High Priority Recommendations:**
⚡ Consider enabling parallel analysis for better performance

## Page Structure Analysis (Parallel)
[Parallel execution data with resource monitoring]

### Resource Usage Monitoring
- **Peak Memory Usage:** 67.89 MB
- **CPU Time:** 234ms
- **Current Memory Usage:** 45.67 MB

**Analysis Steps Performance:**
1. **Structure Analysis**: 89ms (Memory Δ: 12.34MB)
2. **Performance Metrics**: 123ms (Memory Δ: 23.45MB)
3. **Resource Monitoring**: 22ms (Memory Δ: 5.67MB)
```

### browser_find_elements (Enhanced)

With UnifiedSystem integration:

```json
{
  "name": "browser_find_elements",
  "arguments": {
    "searchCriteria": {
      "text": "Submit",
      "role": "button"
    },
    "useUnifiedSystem": true,
    "enableEnhancedDiscovery": true,
    "performanceThreshold": 300
  }
}
```

## Performance Thresholds Configuration

### DiagnosticThresholds System

Centralized, runtime-configurable threshold management:

```typescript
import { getCurrentThresholds } from './src/diagnostics/DiagnosticThresholds.js';

const thresholds = getCurrentThresholds();

// Get current configuration diagnostics
const diagnostics = thresholds.getConfigDiagnostics();
console.log('Status:', diagnostics.status);
console.log('Customizations:', diagnostics.customizations);
console.log('Warnings:', diagnostics.warnings);

// Update thresholds at runtime
thresholds.updateThresholds({
  executionTime: {
    pageAnalysis: 500,
    elementDiscovery: 300,
    resourceMonitoring: 200,
    parallelAnalysis: 2000
  },
  memory: {
    maxMemoryUsage: 200 * 1024 * 1024,
    memoryLeakThreshold: 100 * 1024 * 1024
  },
  dom: {
    totalElements: 5000,
    maxDepth: 25,
    elementsWarning: 2000,
    elementsDanger: 4000
  }
});
```

### Default Thresholds

| Category | Metric | Warning | Danger | Description |
|----------|--------|---------|--------|-------------|
| **Execution Time** | pageAnalysis | 300ms | - | Page structure analysis |
| | elementDiscovery | 200ms | - | Element search operations |
| | resourceMonitoring | 100ms | - | Resource usage checks |
| | parallelAnalysis | 2000ms | - | Parallel execution total |
| **Memory** | maxMemoryUsage | 100MB | - | Maximum heap usage |
| | memoryLeakThreshold | 50MB | - | Potential leak detection |
| | gcTriggerThreshold | 80MB | - | Garbage collection trigger |
| **DOM** | totalElements | 1500 | 3000 | Total DOM elements |
| | maxDepth | 15 | 20 | Maximum nesting level |
| | largeSubtrees | 10 | - | Count of large subtrees |
| | largeSubtreeThreshold | 500 | - | Elements per subtree |
| **Interaction** | clickableElements | - | 100 | Interactive elements |
| | formElements | - | 50 | Form input elements |
| **Layout** | fixedElements | - | 10 | Fixed position elements |
| | highZIndexElements | - | 5 | Z-index > 1000 |
| | highZIndexThreshold | 1000 | - | High z-index detection |
| | excessiveZIndexThreshold | 9999 | - | Excessive z-index warning |

## System Health Monitoring

### Performance Metrics Collection

The UnifiedSystem continuously collects performance metrics:

```typescript
const stats = system.getSystemStats();

console.log('Performance Metrics:', {
  totalOperations: stats.performanceMetrics.totalOperations,
  averageExecutionTime: stats.performanceMetrics.averageExecutionTime,
  successRate: stats.performanceMetrics.successRate,
  slowOperations: stats.performanceMetrics.slowOperations
});

console.log('Resource Usage:', {
  currentHandles: stats.resourceUsage.currentHandles,
  peakHandles: stats.resourceUsage.peakHandles,
  memoryLeaks: stats.resourceUsage.memoryLeaks
});

console.log('Error Tracking:', {
  totalErrors: stats.errorCount,
  errorsByType: stats.errorsByType
});
```

### Health Check

Regular health checks ensure system stability:

```typescript
const health = await system.performHealthCheck();

if (health.status === 'degraded') {
  console.log('Issues detected:', health.issues);
  console.log('Recommendations:', health.recommendations);
}
```

## Navigation Context Handling

Enhanced navigation detection and stability:

```typescript
// The system automatically detects and handles navigation
// No more "Execution context was destroyed" errors

// Navigation is detected in:
- browser_navigate
- browser_click (when causing navigation)
- browser_press_key (Enter key navigation)
- browser_goBack/goForward

// Automatic retry logic for post-navigation operations
// Waits for navigation stability before capturing snapshots
```

## Best Practices

### 1. Use UnifiedSystem for Complex Operations
```typescript
// Prefer UnifiedSystem for enhanced error handling
const system = UnifiedDiagnosticSystem.getInstance(page);
const result = await system.analyzePageStructure(true);
```

### 2. Configure for Your Environment
```typescript
// Set appropriate configuration for your use case
SmartConfigManager.getInstance().configureForEnvironment('production');
```

### 3. Monitor Resource Usage
```typescript
// Regular health checks in long-running scripts
const health = await system.performHealthCheck();
if (health.status !== 'healthy') {
  // Take corrective action
}
```

### 4. Optimize Token Usage
```typescript
// Use expectation parameters to reduce response size
{
  expectation: {
    includeSnapshot: false,  // Save ~1000 tokens
    includeConsole: false,   // Save ~200 tokens
    includeNetwork: false,   // Save ~500 tokens
  }
}
```

### 5. Batch Operations
```typescript
// Group related operations for efficiency
{
  steps: [/* multiple operations */],
  globalExpectation: { includeSnapshot: false }
}
```

### 6. Handle Parallel Analysis Recommendations
```typescript
// Check if parallel analysis is recommended
const recommendation = await analyzer.shouldUseParallelAnalysis();
if (recommendation.recommended) {
  // Use parallel analysis for better performance
}
```

## Error Recovery Strategies

### Automatic Retry with Context
The UnifiedSystem implements intelligent retry logic:

1. **Navigation Detection**: Automatically detects page navigation
2. **Context Validation**: Checks if execution context is valid
3. **Stability Waiting**: Waits for page to stabilize
4. **Retry Logic**: Up to 3 attempts with exponential backoff
5. **Fallback Options**: Provides alternatives on failure

### Enhanced Error Messages
All errors now include:
- **Root cause analysis**
- **Alternative selectors** (up to 5 suggestions)
- **Page state context**
- **Performance metrics**
- **Actionable recommendations**

## Migration Guide

### From Basic Diagnostics to UnifiedSystem

**Before:**
```typescript
const analyzer = new PageAnalyzer(page);
const analysis = await analyzer.analyzePageStructure();
```

**After:**
```typescript
const system = UnifiedDiagnosticSystem.getInstance(page);
const result = await system.analyzePageStructure(true);
if (result.success) {
  const analysis = result.data;
}
```

### Using Configuration Overrides

**Runtime configuration:**
```typescript
const system = UnifiedDiagnosticSystem.getInstance(page, {
  features: {
    enableParallelAnalysis: true,
    enableResourceLeakDetection: true
  },
  performance: {
    thresholds: customThresholds
  }
});
```

## Performance Benchmarks

### Token Reduction Results
- **Sequential operations**: Baseline (100%)
- **With expectation parameters**: 40-50% of baseline
- **Batch execution**: 30-35% of baseline
- **Batch + expectations**: 20-30% of baseline

### Execution Performance
- **Standard analysis**: ~300ms
- **Parallel analysis**: ~150ms (50% faster)
- **With resource monitoring**: +20ms overhead
- **Element discovery**: ~200ms for 10 alternatives

### Memory Efficiency
- **Base memory**: ~30MB
- **During analysis**: +10-20MB
- **Peak with parallel**: +30-40MB
- **Automatic cleanup**: Returns to base within 30s

## Troubleshooting

### High Memory Usage
```typescript
// Check for resource leaks
const stats = globalResourceManager.getResourceStats();
if (stats.expiredCount > 0) {
  await globalResourceManager.disposeAll();
}
```

### Slow Performance
```typescript
// Adjust thresholds for your environment
config.updateThresholds({
  executionTime: {
    pageAnalysis: 1000,  // Increase timeout
    parallelAnalysis: 3000
  }
});
```

### Navigation Errors
```typescript
// System handles automatically, but you can check:
const isNavigating = await tab.isNavigating();
if (isNavigating) {
  await tab.waitForNavigationComplete();
}
```

## Summary

The three-phase diagnostic system provides:

1. **Phase 1**: Core analysis and error enrichment
2. **Phase 2**: Parallel processing and resource monitoring  
3. **Phase 3**: Unified orchestration and token optimization

Together, these components deliver:
- 50-80% token reduction
- 2x faster analysis with parallel processing
- Automatic error recovery
- Resource leak prevention
- Runtime configuration
- Comprehensive health monitoring

The system is designed to be transparent to users while providing powerful diagnostic capabilities when needed.