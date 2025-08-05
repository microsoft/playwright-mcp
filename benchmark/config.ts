/**
 * Benchmark configuration
 */

export interface BenchmarkConfig {
  servers: {
    original: ServerConfig;
    fast: ServerConfig;
  };
  timeouts: {
    initialization: number;
    toolCall: number;
    screenshotCall: number;
    serverSwitch: number;
    processCleanup: number;
  };
  retries: {
    maxRetries: number;
    retryDelay: number;
  };
  output: {
    resultsDirectory: string;
    filePrefix: string;
  };
  logging: {
    verbose: boolean;
    includeStepDetails: boolean;
  };
}

export interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export const DEFAULT_CONFIG: BenchmarkConfig = {
  servers: {
    original: {
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest', '--isolated', '--headless'],
      env: {
        PWMCP_HEADLESS: 'true',
        PWMCP_DISABLE_WEB_SECURITY: 'true',
        PWMCP_NO_SANDBOX: 'true'
      },
    },
    fast: {
      command: 'node',
      args: ['cli.js', '--isolated', '--headless'],
      env: {
        PWMCP_HEADLESS: 'true',
        PWMCP_DISABLE_WEB_SECURITY: 'true',
        PWMCP_NO_SANDBOX: 'true'
      },
    },
  },
  timeouts: {
    initialization: 3000,
    toolCall: 15000,
    screenshotCall: 20000,
    serverSwitch: 2000,
    processCleanup: 1000,
  },
  retries: {
    maxRetries: 2,
    retryDelay: 2000,
  },
  output: {
    resultsDirectory: 'benchmark',
    filePrefix: 'stable-results',
  },
  logging: {
    verbose: false,
    includeStepDetails: true,
  },
};

/**
 * Alternative URLs for retry scenarios
 */
export const ALTERNATIVE_URLS = [
  'https://httpbin.org/html',
  'https://httpbin.org/json',
  'https://www.w3.org/TR/html401/',
];

/**
 * Kill commands for cleanup
 */
export const KILL_COMMANDS = [
  ['pkill', '-f', 'cli.js --isolated'],
  ['pkill', '-f', '@playwright/mcp.*--isolated'],
  ['pkill', '-f', 'playwright-mcp.*--isolated'],
];
