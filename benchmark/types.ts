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