/**
 * Unified resource disposal manager to eliminate disposal code duplication
 *
 * This manager provides consistent resource disposal with error handling
 * and logging, reducing duplicate disposal patterns across the codebase.
 */

import { createDiagnosticLogger } from '../diagnostics/common/diagnostic-base.js';
import { handleResourceDisposalError } from './commonFormatters.js';

export interface Disposable {
  dispose(): Promise<void>;
}

export interface DisposableManagerOptions {
  category?: string;
  logger?: ReturnType<typeof createDiagnosticLogger>;
  maxParallelDisposals?: number;
}

/**
 * Manages multiple disposable resources with unified error handling
 */
export class DisposableManager implements Disposable {
  private readonly disposables = new Set<Disposable>();
  private readonly category: string;
  private readonly logger: ReturnType<typeof createDiagnosticLogger>;
  private readonly maxParallelDisposals: number;
  private disposed = false;

  constructor(options: DisposableManagerOptions = {}) {
    this.category = options.category ?? 'DisposableManager';
    this.logger =
      options.logger ?? createDiagnosticLogger('DisposableManager', 'resource');
    this.maxParallelDisposals = options.maxParallelDisposals ?? 10;
  }

  /**
   * Register a resource for automatic disposal
   */
  register<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      throw new Error(
        'Cannot register resource: DisposableManager already disposed'
      );
    }

    this.disposables.add(resource);
    return resource;
  }

  /**
   * Unregister a resource (useful when resource is manually disposed)
   */
  unregister(resource: Disposable): boolean {
    return this.disposables.delete(resource);
  }

  /**
   * Get count of currently registered disposables
   */
  getRegisteredCount(): number {
    return this.disposables.size;
  }

  /**
   * Check if manager has been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose all registered resources
   * Uses batched parallel disposal to avoid overwhelming the system
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const resources = Array.from(this.disposables);

    if (resources.length === 0) {
      return;
    }

    this.logger.debug(
      `Disposing ${resources.length} resources in ${this.category}`
    );

    try {
      await this.disposeInBatches(resources);
      this.disposables.clear();
      this.logger.debug(
        `Successfully disposed all resources in ${this.category}`
      );
    } catch (error) {
      this.logger.error(`Error during disposal in ${this.category}`, error);
      throw error;
    }
  }

  /**
   * Dispose resources in parallel batches to prevent overwhelming the system
   */
  private async disposeInBatches(resources: Disposable[]): Promise<void> {
    const batches = this.createBatches(resources, this.maxParallelDisposals);

    for (const batch of batches) {
      const disposePromises = batch.map((resource) =>
        this.safeDisposeResource(resource)
      );

      // Use allSettled to continue even if some disposals fail
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential batch processing is required for system stability
      const results = await Promise.allSettled(disposePromises);

      // Log any disposal failures
      this.logDisposalResults(results, batch.length);
    }
  }

  /**
   * Create batches of resources for parallel disposal
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Safely dispose a single resource with error handling
   */
  private async safeDisposeResource(resource: Disposable): Promise<void> {
    try {
      await resource.dispose();
    } catch (error) {
      handleResourceDisposalError(
        error,
        `${this.category} resource`,
        (message) => this.logger.warn(message)
      );
    }
  }

  /**
   * Log disposal batch results
   */
  private logDisposalResults(
    results: PromiseSettledResult<void>[],
    batchSize: number
  ): void {
    const failures = results.filter(
      (result) => result.status === 'rejected'
    ).length;
    const successes = batchSize - failures;

    if (failures > 0) {
      this.logger.warn(
        `Batch disposal completed: ${successes} succeeded, ${failures} failed`
      );
    } else {
      this.logger.debug(
        `Batch disposal completed: ${successes} resources disposed successfully`
      );
    }
  }
}

/**
 * Factory function to create DisposableManager with common configurations
 */
export function createDisposableManager(
  category: string,
  options: Omit<DisposableManagerOptions, 'category'> = {}
): DisposableManager {
  return new DisposableManager({ ...options, category });
}

/**
 * Auto-disposing wrapper for resources
 * Useful for temporary resources that should be disposed automatically
 */
export class AutoDisposableWrapper<T extends Disposable> implements Disposable {
  private disposed = false;
  private readonly resource: T;

  constructor(resource: T, timeoutMs?: number) {
    this.resource = resource;
    if (timeoutMs !== undefined) {
      setTimeout(() => {
        if (!this.disposed) {
          this.dispose();
        }
      }, timeoutMs);
    }
  }

  /**
   * Get the wrapped resource
   */
  get(): T {
    if (this.disposed) {
      throw new Error('Cannot access disposed resource');
    }
    return this.resource;
  }

  /**
   * Check if resource has been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the wrapped resource
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    await this.resource.dispose();
  }
}

/**
 * Create an auto-disposing wrapper for a resource
 */
export function createAutoDisposable<T extends Disposable>(
  resource: T,
  timeoutMs?: number
): AutoDisposableWrapper<T> {
  return new AutoDisposableWrapper(resource, timeoutMs);
}
