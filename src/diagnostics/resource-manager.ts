import debug from 'debug';

const resourceDebug = debug('pw:mcp:resource');

export interface IDisposable {
  dispose(): Promise<void>;
}

export interface ResourceTracker {
  trackResource<T extends Record<string, unknown>>(
    resource: T,
    disposeMethod: keyof T
  ): string;
  untrackResource(id: string): void;
  disposeAll(): Promise<void>;
  getActiveCount(): number;
}

export interface SmartTracker extends ResourceTracker {
  setDisposeTimeout(timeout: number): void;
  getDisposeTimeout(): number;
}

/**
 * Central resource management system for handling disposable resources
 * like ElementHandles and Frames to prevent memory leaks
 */
interface TrackedResource {
  resource: Record<string, unknown>;
  disposeMethod: string;
  timestamp: number;
}

export class ResourceManager implements SmartTracker {
  private readonly resources = new Map<string, TrackedResource>();
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: nextId is used in trackResource method
  private nextId = 0;
  private disposeTimeout = 30_000; // 30 seconds default
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  trackResource<T extends Record<string, unknown>>(
    resource: T,
    disposeMethod: keyof T
  ): string {
    const id = `resource_${this.nextId++}`;
    this.resources.set(id, {
      resource,
      disposeMethod: disposeMethod as string,
      timestamp: Date.now(),
    });
    return id;
  }

  untrackResource(id: string): void {
    this.resources.delete(id);
  }

  async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = [];

    for (const [id, { resource, disposeMethod }] of Array.from(
      this.resources.entries()
    )) {
      try {
        if (resource && typeof resource[disposeMethod] === 'function') {
          const disposeFn = resource[disposeMethod] as () => Promise<void>;
          disposePromises.push(disposeFn());
        }
      } catch (error) {
        // Failed to dispose resource - continue cleanup
        resourceDebug(`Failed to dispose resource ${id}:`, error);
      }
    }

    await Promise.allSettled(disposePromises);
    this.resources.clear();
  }

  getActiveCount(): number {
    return this.resources.size;
  }

  setDisposeTimeout(timeout: number): void {
    this.disposeTimeout = timeout;
  }

  getDisposeTimeout(): number {
    return this.disposeTimeout;
  }

  createSmartHandle<T extends Record<string, unknown>>(
    resource: T,
    disposeMethod: keyof T
  ): { handle: T; id: string } {
    const id = this.trackResource(resource, disposeMethod);
    return { handle: resource, id };
  }

  getResourceStats(): {
    totalTracked: number;
    activeCount: number;
    expiredCount: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let expiredCount = 0;

    for (const [, { timestamp }] of Array.from(this.resources.entries())) {
      if (now - timestamp > this.disposeTimeout) {
        expiredCount++;
      }
    }

    return {
      totalTracked: this.resources.size,
      activeCount: this.resources.size - expiredCount,
      expiredCount,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredResources().catch(() => {
        // Cleanup errors are handled internally
      });
    }, this.disposeTimeout / 2); // Run cleanup every half of timeout period
  }

  private async cleanupExpiredResources(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, { timestamp }] of Array.from(this.resources.entries())) {
      if (now - timestamp > this.disposeTimeout) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      const entry = this.resources.get(id);
      if (entry) {
        try {
          if (
            entry.resource &&
            typeof entry.resource[entry.disposeMethod] === 'function'
          ) {
            const disposeFn = entry.resource[
              entry.disposeMethod
            ] as () => Promise<void>;
            // biome-ignore lint/nursery/noAwaitInLoop: Sequential resource disposal is necessary to prevent memory leaks
            await disposeFn();
          }
        } catch (error) {
          // Failed to dispose expired resource - continue cleanup
          resourceDebug(`Failed to dispose expired resource ${id}:`, error);
        }
        this.untrackResource(id);
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await this.disposeAll();
  }
}

// Global resource manager instance
export const globalResourceManager = new ResourceManager();
