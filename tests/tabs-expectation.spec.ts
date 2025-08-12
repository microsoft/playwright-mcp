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

import {
  createMultiTabScenario,
  createTwoTabScenario,
  executeTabToolTest,
  setupTabNavigation,
  TAB_EXPECTATION_TEST_CASES,
  TabTestScenarioBuilder,
} from './enhanced-test-utils.js';
import { expect, test } from './fixtures.js';
import { createMinimalExpectation } from './test-utils.js';

test.describe('Tabs Tools Expectation Parameter', () => {
  test.describe('browser_tab_list', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const scenario = new TabTestScenarioBuilder()
        .withOriginalPage('<div>Test Page</div>')
        .build();

      await executeTabToolTest(
        client,
        server,
        scenario,
        {
          name: 'browser_tab_list',
          arguments: {
            expectation: {
              ...createMinimalExpectation(),
              includeTabs: true,
            },
          },
        },
        {
          containsSnapshot: false,
          containsConsole: false,
          containsTabs: true,
        },
        (result) => {
          expect(result.content[0].text).toContain('Open tabs');
        }
      );
    });
  });

  test.describe('browser_tab_new', () => {
    for (const testCase of TAB_EXPECTATION_TEST_CASES) {
      test(`should accept expectation parameter with ${testCase.name}`, async ({
        client,
        server,
      }) => {
        const scenario = createTwoTabScenario().build();

        await executeTabToolTest(
          client,
          server,
          scenario,
          {
            name: 'browser_tab_new',
            arguments: {
              url: server.HELLO_WORLD,
              expectation: testCase.expectation,
            },
          },
          testCase.expectedResponse,
          testCase.additionalAssertions
        );
      });
    }
  });

  test.describe('browser_tab_select', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const scenario = createMultiTabScenario().build();
      scenario.setupServer(server);

      await setupTabNavigation(client, server);

      const result = await client.callTool({
        name: 'browser_tab_select',
        arguments: {
          index: 0,
          expectation: createMinimalExpectation(),
        },
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
    });
  });

  test.describe('browser_tab_close', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const scenario = createMultiTabScenario().build();
      scenario.setupServer(server);

      await setupTabNavigation(client, server);

      const result = await client.callTool({
        name: 'browser_tab_close',
        arguments: {
          index: 1,
          expectation: createMinimalExpectation(),
        },
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
    });
  });
});
