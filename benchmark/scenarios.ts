/**
 * Predefined benchmark scenarios
 */

import { BenchmarkScenario } from './types.js';

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    name: 'Baseline Comparison',
    description: 'Default behavior without optimization',
    steps: [
      { tool: 'browser_navigate', args: { url: 'https://example.com' } },
      { tool: 'browser_snapshot', args: {} }
    ]
  },

  {
    name: 'Code Suppression',
    description: 'Navigation without showing Playwright code',
    steps: [
      {
        tool: 'browser_navigate',
        args: { url: 'https://example.com' },
        fastArgs: {
          url: 'https://example.com',
          expectation: { includeCode: false }
        }
      }
    ]
  },

  {
    name: 'Minimal Response',
    description: 'Only show operation result',
    steps: [
      {
        tool: 'browser_navigate',
        args: { url: 'https://example.com' },
        fastArgs: {
          url: 'https://example.com',
          expectation: {
            includeCode: false,
            includeSnapshot: false,
            includeConsole: false,
            includeTabs: false
          }
        }
      }
    ]
  },

  {
    name: 'Snapshot Size Optimization',
    description: 'Limited snapshot with size constraint',
    steps: [
      { tool: 'browser_navigate', args: { url: 'https://example.com' } },
      {
        tool: 'browser_snapshot',
        args: {},
        fastArgs: {
          expectation: {
            includeConsole: false,
            snapshotOptions: {
              maxLength: 100
            }
          }
        }
      }
    ]
  },

  {
    name: 'Screenshot Optimization',
    description: 'Screenshot with image compression',
    steps: [
      { tool: 'browser_navigate', args: { url: 'https://example.com' } },
      {
        tool: 'browser_take_screenshot',
        args: { type: 'png', fullPage: false },
        fastArgs: {
          type: 'jpeg',
          expectation: {
            includeCode: false,
            imageOptions: {
              format: 'jpeg',
              quality: 50,
              maxWidth: 300
            }
          }
        }
      }
    ]
  }
];
