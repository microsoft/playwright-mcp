/**
 * Performance-related type definitions for the unified diagnostic system
 */

export interface MetricsThresholds {
  executionTime: {
    pageAnalysis: number;
    elementDiscovery: number;
    resourceMonitoring: number;
    parallelAnalysis: number;
  };
  memory: {
    maxMemoryUsage: number;
    memoryLeakThreshold: number;
    gcTriggerThreshold: number;
  };
  performance: {
    domElementLimit: number;
    maxDepthLimit: number;
    largeSubtreeThreshold: number;
  };
  dom: {
    totalElements: number;
    maxDepth: number;
    largeSubtrees: number;
    // Additional properties used by PageAnalyzer
    elementsWarning: number;
    elementsDanger: number;
    depthWarning: number;
    depthDanger: number;
    largeSubtreeThreshold: number;
  };
  interaction: {
    clickableElements: number;
    formElements: number;
    // Additional properties used by PageAnalyzer
    clickableHigh: number;
  };
  layout: {
    fixedElements: number;
    highZIndexElements: number;
    // Additional properties used by PageAnalyzer
    highZIndexThreshold: number;
    excessiveZIndexThreshold: number;
  };
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuTime?: number;
  operationCount: number;
  errorCount: number;
  successRate: number;
  warnings?: Array<{
    type: string;
    level: string;
    message: string;
  }>;
  domMetrics?: {
    totalElements: number;
    maxDepth: number;
    largeSubtrees: Array<{
      selector: string;
      elementCount: number;
      description: string;
    }>;
  };
  interactionMetrics?: {
    clickableElements: number;
    formElements: number;
    disabledElements: number;
  };
  resourceMetrics?: {
    imageCount: number;
    estimatedImageSize: string;
    scriptTags: number;
    externalScripts: number;
    inlineScripts: number;
    stylesheetCount: number;
  };
  layoutMetrics?: {
    fixedElements: Array<{
      selector: string;
      purpose: string;
      zIndex: number;
    }>;
    highZIndexElements: Array<{
      selector: string;
      zIndex: number;
      description: string;
    }>;
    overflowHiddenElements: number;
  };
}

export interface SystemPerformanceStats {
  totalOperations: number;
  averageExecutionTime: number;
  peakMemoryUsage: number;
  currentHandles: number;
  errorRate: number;
  uptime: number;
}

export interface OperationTiming {
  start: number;
  end: number;
  duration: number;
  phase?: string;
  operation: string;
}

export interface ResourceSnapshot {
  timestamp: number;
  memoryUsage: {
    used: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  handles: number;
  operationId?: string;
}

export interface PerformanceWarning {
  type: 'execution' | 'memory' | 'resource' | 'error';
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  actual: number;
  suggestions?: string[];
  component?: string;
  operation?: string;
}

export interface PerformanceReport {
  summary: SystemPerformanceStats;
  warnings: PerformanceWarning[];
  metrics: PerformanceMetrics;
  trends: {
    executionTimeChange: number; // percentage change
    memoryUsageChange: number;   // percentage change
    errorRateChange: number;     // percentage change
    direction: 'improving' | 'degrading' | 'stable';
  };
  recommendations: string[];
}

export interface AdaptiveThresholds {
  current: MetricsThresholds;
  baseline: MetricsThresholds;
  adjustmentHistory: Array<{
    timestamp: number;
    component: string;
    metric: string;
    oldValue: number;
    newValue: number;
    reason: string;
  }>;
}

export interface PerformanceOptimization {
  type: 'timeout_adjustment' | 'memory_cleanup' | 'resource_limit' | 'parallel_processing';
  description: string;
  impact: 'low' | 'medium' | 'high';
  implementation: string;
  estimatedImprovement: number; // percentage
}

// Additional exports for existing code compatibility
export interface ParallelAnalysisResult {
  structureAnalysis: any;
  performanceMetrics: any;
  resourceUsage: any;
  executionTime: number;
  errors: Array<{ step: string; error: string }>;
}

export interface ResourceUsage {
  memoryUsage: {
    used: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  cpuTime: number;
  peakMemory: number;
  analysisSteps: Array<{
    step: string;
    duration: number;
    memoryDelta: number;
  }>;
  // Additional properties used by diagnostic system
  duration: number;
  operationName: string;
}

export interface OperationTimeline {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  phase?: string;
  // Additional properties used by diagnostic system
  operationName: string;
  memoryUsage?: {
    used: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
}
