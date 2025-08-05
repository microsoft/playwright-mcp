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
