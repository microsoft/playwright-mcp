import * as playwright from 'playwright';
import { SmartTracker, globalResourceManager } from './ResourceManager.js';

/**
 * Smart wrapper for ElementHandles that automatically manages disposal
 * using Proxy pattern to intercept method calls and ensure cleanup
 */
export class SmartHandle<T extends playwright.ElementHandle> implements ProxyHandler<T> {
  private disposed = false;
  private readonly resourceId: string;
  private readonly disposeTimeout = 30000; // 30 seconds
  private readonly tracker: SmartTracker;

  constructor(
    private resource: T,
    tracker?: SmartTracker
  ) {
    this.tracker = tracker || globalResourceManager;
    this.resourceId = this.tracker.trackResource(resource, 'dispose');
  }

  get(target: T, prop: string | symbol, receiver: any): any {
    if (this.disposed)
      throw new Error('SmartHandle has been disposed');


    const value = (target as any)[prop];

    // Return bound method for function properties
    if (typeof value === 'function')
      return value.bind(target);


    return value;
  }

  set(target: T, prop: string | symbol, value: any, receiver: any): boolean {
    if (this.disposed)
      throw new Error('SmartHandle has been disposed');


    (target as any)[prop] = value;
    return true;
  }

  async dispose(): Promise<void> {
    if (this.disposed)
      return;

    try {
      if (this.resource && typeof this.resource.dispose === 'function')
        await this.resource.dispose();

    } catch (error) {
      console.warn('[SmartHandle] Dispose failed:', error);
    } finally {
      this.disposed = true;
      this.tracker.untrackResource(this.resourceId);
    }
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  getResource(): T {
    if (this.disposed)
      throw new Error('SmartHandle has been disposed');

    return this.resource;
  }
}

/**
 * Factory function to create smart handles with automatic proxy wrapping
 */
export function createSmartHandle<T extends playwright.ElementHandle>(
  elementHandle: T,
  tracker?: SmartTracker
): T {
  const smartHandle = new SmartHandle(elementHandle, tracker);
  return new Proxy(elementHandle, smartHandle) as T;
}

/**
 * Batch manager for handling multiple smart handles efficiently
 */
export class SmartHandleBatch {
  private handles: SmartHandle<any>[] = [];
  private disposed = false;

  add<T extends playwright.ElementHandle>(handle: T, tracker?: SmartTracker): T {
    if (this.disposed)
      throw new Error('SmartHandleBatch has been disposed');


    const smartHandle = new SmartHandle(handle, tracker);
    this.handles.push(smartHandle);
    return new Proxy(handle, smartHandle) as T;
  }

  async disposeAll(): Promise<void> {
    if (this.disposed)
      return;

    const disposePromises = this.handles.map(handle => handle.dispose());
    await Promise.allSettled(disposePromises);

    this.handles.length = 0;
    this.disposed = true;
  }

  getActiveCount(): number {
    return this.handles.filter(handle => !handle.isDisposed()).length;
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}
