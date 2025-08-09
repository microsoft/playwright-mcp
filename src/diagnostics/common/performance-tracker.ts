/**
 * Common performance tracking and metrics collection utility
 */

export interface PerformanceMetric {
  operation: string;
  component: string;
  executionTime: number;
  timestamp: number;
  success: boolean;
  memoryUsage?: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceStats {
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  totalOperations: number;
  successRate: number;
  recentFailures: number;
}

export class PerformanceTracker {
  private readonly metrics: PerformanceMetric[] = [];
  private readonly maxHistorySize: number;

  constructor(maxHistorySize = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Wrap an operation with performance tracking
   */
  async trackOperation<T>(
    operation: string,
    component: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    let success = false;
    let result: T;

    try {
      result = await fn();
      success = true;
      return {
        result,
        metric: this.recordMetric(
          operation,
          component,
          startTime,
          success,
          startMemory,
          metadata
        ),
      };
    } catch (error) {
      this.recordMetric(
        operation,
        component,
        startTime,
        success,
        startMemory,
        metadata
      );
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(
    operation: string,
    component: string,
    startTime: number,
    success: boolean,
    startMemory: number,
    metadata?: Record<string, unknown>
  ): PerformanceMetric {
    const executionTime = Date.now() - startTime;
    const currentMemory = process.memoryUsage().heapUsed;

    const metric: PerformanceMetric = {
      operation,
      component,
      executionTime,
      timestamp: startTime,
      success,
      memoryUsage: currentMemory - startMemory,
      metadata,
    };

    this.addMetric(metric);
    return metric;
  }

  /**
   * Add metric to history with size management
   */
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Maintain history size limit
    if (this.metrics.length > this.maxHistorySize) {
      const excessCount = this.metrics.length - this.maxHistorySize;
      this.metrics.splice(0, excessCount);
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getOperationStats(operation: string, component?: string): PerformanceStats {
    const relevantMetrics = this.metrics.filter(
      (m) =>
        m.operation === operation && (!component || m.component === component)
    );

    if (relevantMetrics.length === 0) {
      return {
        averageExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        totalOperations: 0,
        successRate: 1.0,
        recentFailures: 0,
      };
    }

    const executionTimes = relevantMetrics.map((m) => m.executionTime);
    const successCount = relevantMetrics.filter((m) => m.success).length;

    // Recent failures in last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentFailures = relevantMetrics.filter(
      (m) => !m.success && m.timestamp > fiveMinutesAgo
    ).length;

    return {
      averageExecutionTime:
        executionTimes.reduce((sum, time) => sum + time, 0) /
        executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      totalOperations: relevantMetrics.length,
      successRate: successCount / relevantMetrics.length,
      recentFailures,
    };
  }

  /**
   * Get all performance statistics grouped by operation
   */
  getAllStats(): Record<string, PerformanceStats> {
    const operations = [...new Set(this.metrics.map((m) => m.operation))];
    const stats: Record<string, PerformanceStats> = {};

    for (const operation of operations) {
      stats[operation] = this.getOperationStats(operation);
    }

    return stats;
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsInRange(
    startTime: number,
    endTime: number,
    operation?: string,
    component?: string
  ): PerformanceMetric[] {
    return this.metrics.filter(
      (m) =>
        m.timestamp >= startTime &&
        m.timestamp <= endTime &&
        (!operation || m.operation === operation) &&
        (!component || m.component === component)
    );
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get recent metrics (last N)
   */
  getRecentMetrics(limit = 50): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Detect performance anomalies
   */
  detectAnomalies(
    operation: string,
    threshold = 2.0
  ): {
    slowOperations: PerformanceMetric[];
    recommendations: string[];
  } {
    const stats = this.getOperationStats(operation);
    const recentMetrics = this.getMetricsInRange(
      Date.now() - 10 * 60 * 1000, // Last 10 minutes
      Date.now(),
      operation
    );

    const slowOperations = recentMetrics.filter(
      (m) => m.executionTime > stats.averageExecutionTime * threshold
    );

    const recommendations: string[] = [];

    if (slowOperations.length > 0) {
      recommendations.push(
        `${slowOperations.length} slow operations detected for ${operation}`
      );
    }

    if (stats.successRate < 0.9) {
      recommendations.push(
        `Low success rate (${(stats.successRate * 100).toFixed(1)}%) for ${operation}`
      );
    }

    if (stats.recentFailures > 3) {
      recommendations.push(
        `${stats.recentFailures} recent failures detected for ${operation}`
      );
    }

    return {
      slowOperations,
      recommendations,
    };
  }
}

// Global performance tracker instance
export const globalPerformanceTracker = new PerformanceTracker();
