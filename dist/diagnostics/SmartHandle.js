import { globalResourceManager } from './ResourceManager.js';
/**
 * Smart wrapper for ElementHandles that automatically manages disposal
 * using Proxy pattern to intercept method calls and ensure cleanup
 */
export class SmartHandle {
    resource;
    disposed = false;
    resourceId;
    disposeTimeout = 30000; // 30 seconds
    tracker;
    constructor(resource, tracker) {
        this.resource = resource;
        this.tracker = tracker || globalResourceManager;
        this.resourceId = this.tracker.trackResource(resource, 'dispose');
    }
    get(target, prop, receiver) {
        if (this.disposed) {
            throw new Error('SmartHandle has been disposed');
        }
        const value = target[prop];
        // Return bound method for function properties
        if (typeof value === 'function') {
            return value.bind(target);
        }
        return value;
    }
    set(target, prop, value, receiver) {
        if (this.disposed) {
            throw new Error('SmartHandle has been disposed');
        }
        target[prop] = value;
        return true;
    }
    async dispose() {
        if (this.disposed)
            return;
        try {
            if (this.resource && typeof this.resource.dispose === 'function') {
                await this.resource.dispose();
            }
        }
        catch (error) {
            console.warn('[SmartHandle] Dispose failed:', error);
        }
        finally {
            this.disposed = true;
            this.tracker.untrackResource(this.resourceId);
        }
    }
    isDisposed() {
        return this.disposed;
    }
    getResource() {
        if (this.disposed) {
            throw new Error('SmartHandle has been disposed');
        }
        return this.resource;
    }
}
/**
 * Factory function to create smart handles with automatic proxy wrapping
 */
export function createSmartHandle(elementHandle, tracker) {
    const smartHandle = new SmartHandle(elementHandle, tracker);
    return new Proxy(elementHandle, smartHandle);
}
/**
 * Batch manager for handling multiple smart handles efficiently
 */
export class SmartHandleBatch {
    handles = [];
    disposed = false;
    add(handle, tracker) {
        if (this.disposed) {
            throw new Error('SmartHandleBatch has been disposed');
        }
        const smartHandle = new SmartHandle(handle, tracker);
        this.handles.push(smartHandle);
        return new Proxy(handle, smartHandle);
    }
    async disposeAll() {
        if (this.disposed)
            return;
        const disposePromises = this.handles.map(handle => handle.dispose());
        await Promise.allSettled(disposePromises);
        this.handles.length = 0;
        this.disposed = true;
    }
    getActiveCount() {
        return this.handles.filter(handle => !handle.isDisposed()).length;
    }
    isDisposed() {
        return this.disposed;
    }
}
