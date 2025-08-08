/**
 * Benchmark execution engine
 */

import type { BenchmarkConfig } from './config.js';
import type { MCPServerManager } from './mcp-server-manager.js';
import type {
  BenchmarkScenario,
  BenchmarkStep,
  ScenarioResult,
  ServerType,
  StepResult,
} from './types.js';
import { getAlternativeUrl, withRetry } from './utils.js';

export class BenchmarkEngine {
  private config: BenchmarkConfig;
  private serverManager: MCPServerManager;
  private lastServerType: ServerType | null = null;

  constructor(config: BenchmarkConfig, serverManager: MCPServerManager) {
    this.config = config;
    this.serverManager = serverManager;
  }

  /**
   * Run all scenarios on a specific server
   */
  async runAllScenariosOnServer(
    serverType: ServerType,
    scenarios: BenchmarkScenario[]
  ): Promise<
    Array<{ name: string; description: string; result: ScenarioResult }>
  > {
    if (!this.serverManager.isServerRunning(serverType)) {
      throw new Error(`${serverType} server is not running`);
    }

    const results: Array<{
      name: string;
      description: string;
      result: ScenarioResult;
    }> = [];

    // Scenarios must run sequentially to avoid interference
    for (const scenario of scenarios) {
      const steps =
        serverType === 'fast' && scenario.fastSteps
          ? scenario.fastSteps
          : scenario.steps;

      const result = await this.runScenario(serverType, steps);

      results.push({
        name: scenario.name,
        description: scenario.description,
        result,
      });
    }

    return results;
  }

  /**
   * Run a single scenario on a server
   */
  private async runScenario(
    serverType: ServerType,
    steps: BenchmarkStep[]
  ): Promise<ScenarioResult> {
    let totalSize = 0;
    let totalTokens = 0;
    let success = true;
    const stepResults: StepResult[] = [];

    // Steps must run sequentially within each scenario
    for (const step of steps) {
      try {
        const result = await this.executeStepWithRetry(serverType, step);
        totalSize += result.size;
        totalTokens += result.tokens;
        stepResults.push(result);
      } catch (error) {
        success = false;
        stepResults.push({
          size: 0,
          tokens: 0,
          error: (error as Error).message,
        });

        // Continue with next step instead of breaking entire execution
      }
    }

    return { success, totalSize, totalTokens, stepResults };
  }

  /**
   * Execute a step with retry logic
   */
  private executeStepWithRetry(
    serverType: ServerType,
    step: BenchmarkStep
  ): Promise<StepResult> {
    const args =
      serverType === 'fast' && step.fastArgs ? step.fastArgs : step.args;

    return withRetry(
      async () => {
        const result = await this.serverManager.callTool(
          serverType,
          step.tool,
          args
        );
        return {
          size: result.size,
          tokens: result.tokens,
          response: result.response,
        };
      },
      this.config.retries.maxRetries,
      this.config.retries.retryDelay,
      (attempt, _error) => {
        // For navigation retries, try alternative URLs
        if (
          step.tool === 'browser_navigate' &&
          attempt <= getAlternativeUrl(attempt, '').length
        ) {
          const alternativeUrl = getAlternativeUrl(
            attempt,
            String(args.url || '')
          );
          // Update args for retry (this modifies the args for the retry attempt)
          Object.assign(args, { url: alternativeUrl });
        }
      }
    );
  }

  /**
   * Get current server type (for tracking)
   */
  getCurrentServerType(): ServerType | null {
    return this.lastServerType;
  }

  /**
   * Reset server tracking
   */
  resetServerTracking(): void {
    this.lastServerType = null;
  }
}
