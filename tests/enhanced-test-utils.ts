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

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { expect, test } from './fixtures.js';
import {
  createFullExpectation,
  createMinimalExpectation,
  createMultiTabsSetup,
  createTestPage,
  expectToolCallResponse,
  setupTabTestPages,
  type TestPageContent,
} from './test-utils.js';

export interface TabTestScenario {
  originalPage: TestPageContent;
  newPage?: TestPageContent;
  setupServer: (server: any) => void;
}

export interface ExpectationTestCase {
  name: string;
  expectation: any;
  expectedResponse: {
    containsSnapshot?: boolean;
    containsConsole?: boolean;
    containsCode?: boolean;
    containsDownloads?: boolean;
    containsTabs?: boolean;
  };
  additionalAssertions?: (result: any) => void;
}

/**
 * Standard expectation test cases for tab tools
 */
export const TAB_EXPECTATION_TEST_CASES: ExpectationTestCase[] = [
  {
    name: 'minimal response',
    expectation: createMinimalExpectation(),
    expectedResponse: {
      containsSnapshot: false,
      containsConsole: false,
      containsTabs: false,
    },
  },
  {
    name: 'full response',
    expectation: createFullExpectation(),
    expectedResponse: {
      containsSnapshot: true,
    },
    additionalAssertions: (result) => {
      expect(result.content[0].text).toContain('Open tabs');
    },
  },
];

/**
 * Builder for creating consistent tab test scenarios
 */
export class TabTestScenarioBuilder {
  private scenario: TabTestScenario;

  constructor() {
    this.scenario = {
      originalPage: createTestPage('<div>Test Page</div>'),
      setupServer: () => {
        // Empty default implementation
      },
    };
  }

  withOriginalPage(content: string, title = 'Test Page'): this {
    this.scenario.originalPage = createTestPage(content, title);
    return this;
  }

  withNewPage(content: string, title = 'New Tab Content'): this {
    this.scenario.newPage = createTestPage(content, title);
    return this;
  }

  withMultiTabSetup(): this {
    const { setupServer } = createMultiTabsSetup();
    this.scenario.setupServer = setupServer;
    return this;
  }

  withCustomSetup(setupFn: (server: any) => void): this {
    this.scenario.setupServer = setupFn;
    return this;
  }

  build(): TabTestScenario {
    if (this.scenario.newPage && !this.scenario.setupServer) {
      this.scenario.setupServer = (server) => {
        setupTabTestPages(server, [
          {
            path: this.scenario.originalPage.path,
            page: this.scenario.originalPage,
          },
          { path: '/new', page: this.scenario.newPage as TestPageContent },
        ]);
      };
    } else if (!this.scenario.setupServer) {
      this.scenario.setupServer = (server) => {
        server.setContent(
          this.scenario.originalPage.path,
          this.scenario.originalPage.content,
          this.scenario.originalPage.contentType
        );
      };
    }

    return this.scenario;
  }
}

/**
 * Executes a standard tab tool test with the given scenario and expectation
 */
export async function executeTabToolTest(
  client: Client,
  server: any,
  scenario: TabTestScenario,
  toolCall: {
    name: string;
    arguments: any;
  },
  expectedResponse: ExpectationTestCase['expectedResponse'],
  additionalAssertions?: (result: any) => void
): Promise<any> {
  // Setup server
  scenario.setupServer(server);

  // Navigate to initial page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Execute the tool call
  const result = await client.callTool(toolCall);

  // Validate response
  expectToolCallResponse(result, expectedResponse);

  // Execute additional assertions if provided
  if (additionalAssertions) {
    additionalAssertions(result);
  }

  return result;
}

/**
 * Creates a test suite for tab tools with expectation parameters
 */
export function createTabToolExpectationSuite(
  toolName: string,
  createToolCall: (expectation: any) => { name: string; arguments: any },
  scenarioBuilder: () => TabTestScenarioBuilder
): void {
  test.describe(`${toolName}`, () => {
    for (const testCase of TAB_EXPECTATION_TEST_CASES) {
      test(`should accept expectation parameter with ${testCase.name}`, async ({
        client,
        server,
      }) => {
        const scenario = scenarioBuilder().build();
        const toolCall = createToolCall(testCase.expectation);

        await executeTabToolTest(
          client,
          server,
          scenario,
          toolCall,
          testCase.expectedResponse,
          testCase.additionalAssertions
        );
      });
    }
  });
}

/**
 * Creates a standard two-tab setup scenario
 */
export function createTwoTabScenario(): TabTestScenarioBuilder {
  return new TabTestScenarioBuilder()
    .withOriginalPage('<div>Original Tab</div>', 'Original Tab')
    .withNewPage('<div>New Tab Content</div>', 'New Tab Content');
}

/**
 * Creates a multi-tab scenario for tab selection/closing operations
 */
export function createMultiTabScenario(): TabTestScenarioBuilder {
  return new TabTestScenarioBuilder().withMultiTabSetup();
}

/**
 * Executes common tab navigation setup (navigate + create new tab)
 */
export async function setupTabNavigation(
  client: Client,
  server: any,
  secondTabUrl = '/tab2'
): Promise<void> {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_tab_new',
    arguments: { url: `${server.PREFIX}${secondTabUrl}` },
  });
}
