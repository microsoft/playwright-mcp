/**
 * Base threshold type definitions for consolidating common patterns
 * across performance and diagnostic threshold interfaces
 */

// Base threshold structure for warning/danger levels
export interface BaseThreshold {
  warning: number;
  danger: number;
}

// Execution time thresholds base structure
export interface ExecutionTimeThresholds {
  pageAnalysis: number;
  elementDiscovery: number;
  resourceMonitoring: number;
  parallelAnalysis: number;
}

// Memory thresholds base structure
export interface MemoryThresholds {
  maxMemoryUsage: number;
  memoryLeakThreshold: number;
  gcTriggerThreshold: number;
}

// Performance thresholds base structure
export interface PerformanceThresholds {
  domElementLimit: number;
  maxDepthLimit: number;
  largeSubtreeThreshold: number;
}

// DOM-specific thresholds
export interface DomThresholds {
  totalElements: number;
  maxDepth: number;
  largeSubtrees: number;
  elementsWarning: number;
  elementsDanger: number;
  depthWarning: number;
  depthDanger: number;
  largeSubtreeThreshold: number;
}

// Interaction thresholds
export interface InteractionThresholds {
  clickableElements: number;
  formElements: number;
  clickableHigh: number;
}

// Layout thresholds
export interface LayoutThresholds {
  fixedElements: number;
  highZIndexElements: number;
  highZIndexThreshold: number;
  excessiveZIndexThreshold: number;
}

// Consolidated base metrics thresholds structure
export interface BaseMetricsThresholds {
  executionTime: ExecutionTimeThresholds;
  memory: MemoryThresholds;
  performance: PerformanceThresholds;
  dom: DomThresholds;
  interaction: InteractionThresholds;
  layout: LayoutThresholds;
}

// Utility type for making all properties optional (used for configuration)
export type PartialBaseMetricsThresholds = {
  executionTime?: Partial<ExecutionTimeThresholds>;
  memory?: Partial<MemoryThresholds>;
  performance?: Partial<PerformanceThresholds>;
  dom?: Partial<DomThresholds>;
  interaction?: Partial<InteractionThresholds>;
  layout?: Partial<LayoutThresholds>;
};
