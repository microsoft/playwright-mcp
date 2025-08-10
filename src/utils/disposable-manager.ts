/**
 * Unified resource disposal manager to eliminate disposal code duplication
 *
 * This manager provides consistent resource disposal with error handling
 * and logging, reducing duplicate disposal patterns across the codebase.
 */

import { handleResourceDisposalError } from './common-formatters.js';

export interface Disposable {
  dispose(): Promise<void>;
}

export interface DisposableManagerOptions {
  category?: string;
  maxParallelDisposals?: number;
}

/**
 * Manages multiple disposable resources with unified error handling
 */
export class DisposableManager implements Disposable {
  private readonly disposables = new Set<Disposable>();
  private readonly category: string;
  private readonly maxParallelDisposals: number;
  private disposed = false;

  constructor(options: DisposableManagerOptions = {}) {
    this.category = options.category ?? 'DisposableManager';
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
    await this.disposeInBatches(resources);
    this.disposables.clear();
  }

  /**
   * Dispose resources in parallel batches to prevent overwhelming the system
   */
  private async disposeInBatches(resources: Disposable[]): Promise<void> {
    const batches = this.createBatches(resources, this.maxParallelDisposals);
    await this.disposeBatchesRecursive(batches, 0);
  }

  private async disposeBatchesRecursive(
    batches: Disposable[][],
    index: number
  ): Promise<void> {
    if (index >= batches.length) {
      return;
    }

    const batch = batches[index];
    const disposePromises = batch.map((resource) =>
      this.safeDisposeResource(resource)
    );

    // Use allSettled to continue even if some disposals fail
    const results = await Promise.allSettled(disposePromises);

    // Log any disposal failures
    this.logDisposalResults(results, batch.length);

    await this.disposeBatchesRecursive(batches, index + 1);
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
      handleResourceDisposalError(error, `${this.category} resource`, () => {
        // Log handler no-op
      });
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
    const _successes = batchSize - failures;

    // Batch disposal completed - track statistics if needed
    // Success: batchSize - failures, Failures: failures
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
