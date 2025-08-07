/**
 * ResourceUsageMonitor - Phase 2 Resource Monitoring System
 *
 * Monitors memory usage, CPU time, and operation timelines for parallel analysis
 */
export class ResourceUsageMonitor {
    operations = new Map();
    timeline = [];
    /**
     * Start monitoring a specific operation
     */
    startMonitoring(operationName) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        this.operations.set(operationName, {
            startTime,
            startMemory
        });
        this.timeline.push({
            operation: operationName,
            operationName,
            startTime,
            endTime: 0,
            duration: 0,
            memoryUsage: this.formatMemoryUsage(startMemory)
        });
    }
    /**
     * Stop monitoring and return resource usage data
     */
    async stopMonitoring(operationName) {
        const operation = this.operations.get(operationName);
        if (!operation) {
            throw new Error(`Operation '${operationName}' was not started or already stopped`);
        }
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - operation.startTime;
        const result = {
            operationName,
            duration,
            memoryUsage: this.formatMemoryUsage(endMemory),
            cpuTime: 0, // Not available in Node.js without additional measurement
            peakMemory: Math.max(operation.startMemory.heapUsed, endMemory.heapUsed),
            analysisSteps: []
        };
        // Update timeline
        const timelineIndex = this.timeline.findIndex((entry, index) => entry.operationName === operationName && !entry.endTime &&
            index === this.timeline.map(t => t.operationName).lastIndexOf(operationName));
        if (timelineIndex !== -1) {
            this.timeline[timelineIndex].endTime = endTime;
            this.timeline[timelineIndex].duration = duration;
        }
        this.operations.delete(operationName);
        return result;
    }
    /**
     * Get current operation timeline
     */
    getOperationTimeline() {
        return [...this.timeline];
    }
    /**
     * Get current memory usage snapshot
     */
    getCurrentMemoryUsage() {
        return this.formatMemoryUsage(process.memoryUsage());
    }
    /**
     * Clear timeline history
     */
    clearTimeline() {
        this.timeline = [];
    }
    /**
     * Get current resource usage summary
     */
    getResourceUsage() {
        const memoryUsage = process.memoryUsage();
        const currentTime = Date.now();
        return {
            memoryUsage: this.formatMemoryUsage(memoryUsage),
            cpuTime: 0, // Not available in Node.js without additional measurement
            peakMemory: this.getPeakMemoryUsage() || memoryUsage.heapUsed,
            analysisSteps: this.timeline.map(entry => ({
                step: entry.operation,
                duration: entry.duration || 0,
                memoryDelta: 0 // Would need baseline to calculate
            })),
            duration: this.timeline.length > 0 ?
                currentTime - Math.min(...this.timeline.map(t => t.startTime)) : 0,
            operationName: 'ResourceUsageMonitor'
        };
    }
    /**
     * Get peak memory usage from timeline
     */
    getPeakMemoryUsage() {
        if (this.timeline.length === 0) {
            return 0;
        }
        return Math.max(...this.timeline.map(entry => entry.memoryUsage?.used || entry.memoryUsage?.heapUsed || 0));
    }
    /**
     * Format Node.js memory usage to our interface
     */
    formatMemoryUsage(memoryUsage) {
        return {
            used: memoryUsage.heapUsed, // Use heapUsed as the 'used' value
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external,
            rss: memoryUsage.rss,
            arrayBuffers: memoryUsage.arrayBuffers
        };
    }
    /**
     * Dispose and cleanup resources
     */
    dispose() {
        this.operations.clear();
        this.timeline = [];
    }
}
