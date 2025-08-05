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
 * Type definitions for the benchmark system
 */

export interface BenchmarkScenario {
  name: string;
  description: string;
  steps: BenchmarkStep[];
  fastSteps?: BenchmarkStep[];
}

export interface BenchmarkStep {
  tool: string;
  args: Record<string, any>;
  fastArgs?: Record<string, any>;
}

export interface StepResult {
  size: number;
  tokens: number;
  response?: any;
  error?: string;
}

export interface ScenarioResult {
  success: boolean;
  totalSize: number;
  totalTokens: number;
  stepResults: StepResult[];
}

export interface BenchmarkResult {
  name: string;
  description: string;
  original: ScenarioResult;
  fast: ScenarioResult;
}

export interface BenchmarkSummary {
  timestamp: string;
  results: BenchmarkResult[];
  summary: {
    totalOriginalSize: number;
    totalFastSize: number;
    totalOriginalTokens: number;
    totalFastTokens: number;
    avgSizeReduction: number;
    avgTokenReduction: number;
    validComparisons: number;
  };
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type ServerType = 'original' | 'fast';
