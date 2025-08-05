/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Benchmark execution engine
 */

import { BenchmarkConfig } from './config.js';
import {
  BenchmarkScenario,
  BenchmarkStep,
  ScenarioResult,
  StepResult,
  ServerType
} from './types.js';
import { MCPServerManager } from './MCPServerManager.js';
import { RetryUtils } from './utils.js';

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
  ): Promise<Array<{ name: string; description: string; result: ScenarioResult }>> {
    console.log(`\n🚀 Running all scenarios on ${serverType} server...`);

    if (!this.serverManager.isServerRunning(serverType))
      throw new Error(`${serverType} server is not running`);


    const results = [];

    for (const scenario of scenarios) {
      console.log(`\n📋 ${serverType.toUpperCase()}: ${scenario.name}`);
      console.log(`   ${scenario.description}`);

      const steps = (serverType === 'fast' && scenario.fastSteps) ?
        scenario.fastSteps : scenario.steps;

      const result = await this.runScenario(serverType, steps);

      results.push({
        name: scenario.name,
        description: scenario.description,
        result
      });
    }

    return results;
  }

  /**
   * Run a single scenario on a server
   */
  private async runScenario(serverType: ServerType, steps: BenchmarkStep[]): Promise<ScenarioResult> {
    console.log(`\n   Running on ${serverType} server...`);

    let totalSize = 0;
    let totalTokens = 0;
    let success = true;
    const stepResults: StepResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`     Step ${i + 1}/${steps.length}: ${step.tool}`);

      try {
        const result = await this.executeStepWithRetry(serverType, step);
        totalSize += result.size;
        totalTokens += result.tokens;
        stepResults.push(result);

        if (this.config.logging.includeStepDetails)
          console.log(`       ✅ Size: ${result.size} bytes, Tokens: ~${result.tokens}`);

      } catch (error) {
        console.log(`       ❌ ${(error as Error).message}`);
        success = false;
        stepResults.push({
          size: 0,
          tokens: 0,
          error: (error as Error).message
        });

        // Continue with next step instead of breaking entire execution
        if (this.config.logging.verbose)
          console.log(`       ⚠️  Continuing with next step...`);

      }
    }

    return { success, totalSize, totalTokens, stepResults };
  }


  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry(serverType: ServerType, step: BenchmarkStep): Promise<StepResult> {
    const args = (serverType === 'fast' && step.fastArgs) ? step.fastArgs : step.args;

    return RetryUtils.withRetry(
        async () => {
          const result = await this.serverManager.callTool(serverType, step.tool, args);
          return {
            size: result.size,
            tokens: result.tokens,
            response: result.response
          };
        },
        this.config.retries.maxRetries,
        this.config.retries.retryDelay,
        (attempt, error) => {
          console.log(`       ⚠️  Retry ${attempt}/${this.config.retries.maxRetries}: ${error.message}`);

          // For navigation retries, try alternative URLs
          if (step.tool === 'browser_navigate' && attempt <= RetryUtils.getAlternativeUrl(attempt, '').length) {
            const alternativeUrl = RetryUtils.getAlternativeUrl(attempt, args.url);
            console.log(`       🔄 Trying alternative URL: ${alternativeUrl}`);
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
