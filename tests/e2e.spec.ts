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
import { test, expect } from './fixtures';
import fs from 'fs/promises';

test('test tool list', async ({ endtoendClient }) => {
  const { tools: qaTools } = await endtoendClient.listTools();
  expect(qaTools.map(t => t.name)).toEqual([
    'browser_endtoend'
  ]);
});

test('test qa with single url', async ({ endtoendClient }) => {
  const response = await endtoendClient.callTool({
    name: 'browser_endtoend',
    arguments: {
      testCases: [
        {
          testDefinition: 'Validate that the read more button opens the blog posts and the content loads',
        },
        {
          testDefinition: 'Validate that the toggle theme can be opened',
          expect: 'The background color of the website should turn to black if white, or turn to white if black'
        },
      ],
      urls: ['http://localhost:3000']
    }
  });

  console.log('response: ', response);
  await fs.writeFile('qa_response.txt', JSON.stringify(response, null, 2));
});
