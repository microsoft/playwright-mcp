/**
 * ParallelPageAnalyzer - Phase 2 Parallel Analysis Engine
 *
 * Performs parallel structure and performance analysis with resource monitoring
 */
import { PageAnalyzer } from './PageAnalyzer.js';
import { ResourceUsageMonitor } from './ResourceUsageMonitor.js';
export class ParallelPageAnalyzer {
    page;
    pageAnalyzer;
    resourceMonitor;
    constructor(page) {
        this.page = page;
        this.pageAnalyzer = new PageAnalyzer(page);
        this.resourceMonitor = new ResourceUsageMonitor();
    }
    /**
     * Run parallel analysis with resource monitoring
     */
    async runParallelAnalysis() {
        const startTime = Date.now();
        const errors = [];
        const analysisSteps = [];
        console.info('[ParallelPageAnalyzer] Starting parallel analysis with resource monitoring');
        // Start global monitoring
        this.resourceMonitor.startMonitoring('parallel-analysis');
        const startMemory = this.resourceMonitor.getCurrentMemoryUsage();
        let structureAnalysis;
        let performanceMetrics;
        try {
            // Parallel execution of analysis tasks
            console.info('[ParallelPageAnalyzer] Launching parallel analysis tasks');
            const analysisPromises = [
                this.executeWithMonitoring('structure-analysis', async () => {
                    return await this.pageAnalyzer.analyzePageStructure();
                }),
                this.executeWithMonitoring('performance-metrics', async () => {
                    return await this.pageAnalyzer.analyzePerformanceMetrics();
                })
            ];
            const results = await Promise.allSettled(analysisPromises);
            console.info(`[ParallelPageAnalyzer] Parallel tasks completed - results: ${results.length}`);
            // Process results
            results.forEach((result, index) => {
                const stepName = index === 0 ? 'structure-analysis' : 'performance-metrics';
                if (result.status === 'fulfilled') {
                    const { data, step } = result.value;
                    analysisSteps.push(step);
                    console.info(`[ParallelPageAnalyzer] Step '${stepName}' completed successfully in ${step.duration}ms`);
                    if (stepName === 'structure-analysis') {
                        structureAnalysis = data;
                    }
                    else {
                        performanceMetrics = data;
                    }
                }
                else {
                    const errorMsg = result.reason?.message || 'Unknown error';
                    console.error(`[ParallelPageAnalyzer] Step '${stepName}' failed: ${errorMsg}`);
                    errors.push({
                        step: stepName,
                        error: errorMsg
                    });
                }
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Parallel execution failed';
            console.error(`[ParallelPageAnalyzer] Parallel execution failed: ${errorMsg}`);
            errors.push({
                step: 'parallel-execution',
                error: errorMsg
            });
        }
        // Stop global monitoring
        const globalUsage = await this.resourceMonitor.stopMonitoring('parallel-analysis');
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        const endMemory = this.resourceMonitor.getCurrentMemoryUsage();
        console.info(`[ParallelPageAnalyzer] Parallel analysis completed in ${executionTime}ms with ${errors.length} errors`);
        return {
            structureAnalysis,
            performanceMetrics,
            resourceUsage: {
                memoryUsage: endMemory,
                cpuTime: globalUsage.duration,
                peakMemory: this.resourceMonitor.getPeakMemoryUsage(),
                analysisSteps
            },
            executionTime,
            errors
        };
    }
    /**
     * Execute analysis step with individual monitoring
     */
    async executeWithMonitoring(stepName, analysisFunction) {
        console.info(`[ParallelPageAnalyzer] Starting step: ${stepName}`);
        const startMemory = this.resourceMonitor.getCurrentMemoryUsage();
        this.resourceMonitor.startMonitoring(stepName);
        try {
            const data = await analysisFunction();
            const usage = await this.resourceMonitor.stopMonitoring(stepName);
            const endMemory = this.resourceMonitor.getCurrentMemoryUsage();
            const step = {
                step: stepName,
                duration: usage.duration,
                memoryDelta: endMemory.heapUsed - startMemory.heapUsed
            };
            console.info(`[ParallelPageAnalyzer] Step '${stepName}' completed in ${usage.duration}ms (memory delta: ${(step.memoryDelta / 1024 / 1024).toFixed(2)}MB)`);
            return { data, step };
        }
        catch (error) {
            console.error(`[ParallelPageAnalyzer] Step '${stepName}' failed:`, error);
            // Cleanup monitoring on error
            try {
                await this.resourceMonitor.stopMonitoring(stepName);
            }
            catch {
                // Ignore cleanup errors
            }
            throw error;
        }
    }
    /**
     * Get current resource usage snapshot
     */
    getCurrentResourceUsage() {
        return this.resourceMonitor.getCurrentMemoryUsage();
    }
    /**
     * Get operation timeline
     */
    getOperationTimeline() {
        return this.resourceMonitor.getOperationTimeline();
    }
    /**
     * Clear monitoring history
     */
    clearMonitoringHistory() {
        this.resourceMonitor.clearTimeline();
    }
    /**
     * Dispose resources
     */
    async dispose() {
        await this.pageAnalyzer.dispose();
        this.resourceMonitor.dispose();
    }
}
