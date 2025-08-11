/**
 * Common initialization patterns and dependency management
 */

import { DiagnosticError } from '../diagnostic-error.js';
import type { PerformanceTracker } from './performance-tracker.js';

export interface InitializationStage {
  name: string;
  dependencies?: string[];
  components: (() => Promise<void>)[];
  timeout?: number;
  retryCount?: number;
}

export interface InitializationContext {
  componentName: string;
  config?: Record<string, unknown>;
  performanceTracker?: PerformanceTracker;
}

export interface DisposableComponent {
  dispose(): Promise<void>;
}

/**
 * Common initialization manager for diagnostic components
 */
export class InitializationManager {
  private isInitialized = false;
  initializationPromise?: Promise<void>;
  private initializationError?: Error;
  private readonly performanceTracker?: PerformanceTracker;
  private readonly partiallyInitialized: DisposableComponent[] = [];
  private readonly context: InitializationContext;

  constructor(context: InitializationContext) {
    this.context = context;
    this.performanceTracker = context.performanceTracker;
  }

  /**
   * Initialize components with staged dependency resolution
   */
  async initialize(stages: InitializationStage[]): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.initializationError) {
      throw this.initializationError;
    }

    this.initializationPromise = this.performInitialization(stages);

    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      // Convert to DiagnosticError for consistent error handling
      if (error instanceof DiagnosticError) {
        this.initializationError = error;
      } else {
        const baseError =
          error instanceof Error ? error : new Error(String(error));
        this.initializationError = new DiagnosticError(
          `Initialization failed: ${baseError.message}`,
          {
            timestamp: Date.now(),
            component: 'InitializationManager',
            operation: 'initialize',
            suggestions: [
              'Check component dependencies',
              'Verify all required services are available',
              'Review initialization order',
            ],
            context: {
              componentName: this.context.componentName,
              errorStage: 'initialization',
            },
          },
          baseError
        );
      }

      // Error already captured in initializationError
      throw this.initializationError;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  private async performInitialization(
    stages: InitializationStage[]
  ): Promise<void> {
    const completedStages = new Set<string>();

    try {
      // Sequential execution is required due to stage dependencies
      const executeStagesSequentially = async (
        index: number
      ): Promise<void> => {
        if (index >= stages.length) {
          return;
        }

        const stage = stages[index];
        await this.executeStage(stage, completedStages);
        completedStages.add(stage.name);

        await executeStagesSequentially(index + 1);
      };

      await executeStagesSequentially(0);
    } catch (error) {
      // Error will be thrown
      await this.cleanupPartialInitialization();
      throw error;
    }
  }

  private async executeStage(
    stage: InitializationStage,
    completedStages: Set<string>
  ): Promise<void> {
    // Validate dependencies
    if (stage.dependencies) {
      for (const dependency of stage.dependencies) {
        if (!completedStages.has(dependency)) {
          throw new Error(
            `Dependency '${dependency}' not satisfied for stage '${stage.name}'`
          );
        }
      }
    }

    // Execute stage with optional performance tracking
    const executeWithTracking = async () => {
      // Sequential execution is required for components within a stage
      const executeComponentsSequentially = async (
        index: number
      ): Promise<void> => {
        if (index >= stage.components.length) {
          return;
        }

        const componentInit = stage.components[index];
        await this.executeWithRetry(
          componentInit,
          stage.retryCount ?? 1,
          stage.timeout
        );

        await executeComponentsSequentially(index + 1);
      };

      await executeComponentsSequentially(0);
    };

    if (this.performanceTracker) {
      await this.performanceTracker.trackOperation(
        `init-stage-${stage.name}`,
        this.context.componentName,
        executeWithTracking
      );
    } else {
      await executeWithTracking();
    }
  }

  private async executeWithRetry(
    operation: () => Promise<void>,
    retryCount: number,
    timeout?: number
  ): Promise<void> {
    // Retry logic using recursive approach
    const attemptOperation = async (attempt: number): Promise<void> => {
      try {
        if (timeout) {
          await Promise.race([
            operation(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Operation timeout after ${timeout}ms`)),
                timeout
              )
            ),
          ]);
        } else {
          await operation();
        }
        return; // Success
      } catch (error) {
        const lastError =
          error instanceof Error ? error : new Error(String(error));
        if (attempt < retryCount) {
          // Retry silently
          await this.delay(1000 * attempt); // Exponential backoff
          return attemptOperation(attempt + 1);
        }
        throw lastError;
      }
    };

    await attemptOperation(1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add component to cleanup tracking
   */
  trackPartialInitialization(component: DisposableComponent): void {
    this.partiallyInitialized.push(component);
  }

  private async cleanupPartialInitialization(): Promise<void> {
    const cleanupPromises = this.partiallyInitialized.map(async (component) => {
      try {
        await component.dispose();
      } catch {
        // Silently ignore disposal errors during cleanup - component may already be disposed
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.partiallyInitialized.length = 0;
  }

  /**
   * Check if initialization is complete
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get initialization error if any
   */
  getInitializationError(): Error | undefined {
    return this.initializationError;
  }

  /**
   * Reset initialization state (for testing)
   */
  reset(): void {
    this.isInitialized = false;
    this.initializationPromise = undefined;
    this.initializationError = undefined;
    this.partiallyInitialized.length = 0;
  }

  /**
   * Dispose initialization manager and cleanup partial components
   */
  async dispose(): Promise<void> {
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch {
        // Ignore errors during disposal
      }
    }

    await this.cleanupPartialInitialization();
    this.reset();
  }
}

/**
 * Factory functions for creating common initialization stages
 */

/**
 * Create core infrastructure stage (no dependencies)
 */
export function createCoreStage(
  name: string,
  components: (() => Promise<void>)[]
): InitializationStage {
  return {
    name,
    components,
    timeout: 5000, // 5 second timeout for core components
  };
}

/**
 * Create dependent stage with specified dependencies
 */
export function createDependentStage(
  name: string,
  dependencies: string[],
  components: (() => Promise<void>)[]
): InitializationStage {
  return {
    name,
    dependencies,
    components,
    timeout: 10_000, // 10 second timeout for dependent components
    retryCount: 2,
  };
}

/**
 * Create advanced feature stage (depends on core and page-dependent)
 */
export function createAdvancedStage(
  name: string,
  components: (() => Promise<void>)[],
  additionalDependencies: string[] = []
): InitializationStage {
  return {
    name,
    dependencies: [
      'core-infrastructure',
      'page-dependent',
      ...additionalDependencies,
    ],
    components,
    timeout: 15_000, // 15 second timeout for advanced features
    retryCount: 1,
  };
}
