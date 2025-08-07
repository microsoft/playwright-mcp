/**
 * Central resource management system for handling disposable resources
 * like ElementHandles and Frames to prevent memory leaks
 */
export class ResourceManager {
    resources = new Map();
    disposeTimeout = 30000; // 30 seconds default
    nextId = 1;
    cleanupInterval = null;
    constructor() {
        this.startCleanupTimer();
    }
    trackResource(resource, disposeMethod) {
        const id = `resource_${this.nextId++}`;
        this.resources.set(id, {
            resource,
            disposeMethod: disposeMethod,
            timestamp: Date.now()
        });
        return id;
    }
    untrackResource(id) {
        this.resources.delete(id);
    }
    async disposeAll() {
        const disposePromises = [];
        for (const [id, { resource, disposeMethod }] of this.resources.entries()) {
            try {
                if (resource && typeof resource[disposeMethod] === 'function') {
                    disposePromises.push(resource[disposeMethod]());
                }
            }
            catch (error) {
                console.warn(`[ResourceManager] Failed to dispose resource ${id}:`, error);
            }
        }
        await Promise.allSettled(disposePromises);
        this.resources.clear();
    }
    getActiveCount() {
        return this.resources.size;
    }
    setDisposeTimeout(timeout) {
        this.disposeTimeout = timeout;
    }
    getDisposeTimeout() {
        return this.disposeTimeout;
    }
    createSmartHandle(resource, disposeMethod) {
        const id = this.trackResource(resource, disposeMethod);
        return { handle: resource, id };
    }
    getResourceStats() {
        const now = Date.now();
        let expiredCount = 0;
        for (const [, { timestamp }] of this.resources.entries()) {
            if (now - timestamp > this.disposeTimeout) {
                expiredCount++;
            }
        }
        return {
            totalTracked: this.resources.size,
            activeCount: this.resources.size - expiredCount,
            expiredCount,
            memoryUsage: process.memoryUsage().heapUsed
        };
    }
    startCleanupTimer() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredResources();
        }, this.disposeTimeout / 2); // Run cleanup every half of timeout period
    }
    async cleanupExpiredResources() {
        const now = Date.now();
        const expiredIds = [];
        for (const [id, { timestamp }] of this.resources.entries()) {
            if (now - timestamp > this.disposeTimeout) {
                expiredIds.push(id);
            }
        }
        for (const id of expiredIds) {
            const entry = this.resources.get(id);
            if (entry) {
                try {
                    if (entry.resource && typeof entry.resource[entry.disposeMethod] === 'function') {
                        await entry.resource[entry.disposeMethod]();
                    }
                }
                catch (error) {
                    console.warn(`[ResourceManager] Failed to dispose expired resource ${id}:`, error);
                }
                this.untrackResource(id);
            }
        }
        if (expiredIds.length > 0) {
            console.log(`[ResourceManager] Cleaned up ${expiredIds.length} expired resources`);
        }
    }
    async dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        await this.disposeAll();
    }
}
// Global resource manager instance
export const globalResourceManager = new ResourceManager();
