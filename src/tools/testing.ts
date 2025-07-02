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

import { z } from 'zod';
import { defineTool } from './tool.js';

const generateTestSchema = z.object({
  name: z.string().describe('The name of the test'),
  description: z.string().describe('The description of the test'),
  steps: z.array(z.string()).describe('The steps of the test'),
});

const generateTest = defineTool({
  capability: 'testing',

  schema: {
    name: 'browser_generate_playwright_test',
    title: 'Generate a Playwright test',
    description: 'Generate a Playwright test for given scenario',
    inputSchema: generateTestSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    return {
      resultOverride: {
        content: [{
          type: 'text',
          text: instructions(params),
        }],
      },
      code: [],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const instructions = (params: { name: string, description: string, steps: string[] }) => [
  `## Instructions`,
  `- You are a playwright test generator.`,
  `- You are given a scenario and you need to generate a playwright test for it.`,
  '- DO NOT generate test code based on the scenario alone. DO run steps one by one using the tools provided instead.',
  '- Only after all steps are completed, emit a Playwright TypeScript test that uses @playwright/test based on message history',
  '- Save generated test file in the tests directory',
  `Test name: ${params.name}`,
  `Description: ${params.description}`,
  `Steps:`,
  ...params.steps.map((step, index) => `- ${index + 1}. ${step}`),
].join('\n');

export default [
  generateTest,
];
