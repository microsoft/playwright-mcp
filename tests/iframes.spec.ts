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

import { test, expect } from './fixtures.js';

test('stitched aria frames', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `data:text/html,<h1>Hello</h1><iframe src="data:text/html,<button>World</button><main><iframe src='data:text/html,<p>Nested</p>'></iframe></main>"></iframe><iframe src="data:text/html,<h1>Should be invisible</h1>" style="display: none;"></iframe>`,
    },
  })).toContainTextContent(`
\`\`\`yaml
- heading "Hello" [level=1] [ref=s1e3]
- iframe [ref=s1e4]:
  - button "World" [ref=f1s1e3]
  - main [ref=f1s1e4]:
    - iframe [ref=f1s1e5]:
      - paragraph [ref=f2s1e3]: Nested
\`\`\``);

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'World',
      ref: 'f1s1e3',
    },
  })).toContainTextContent(`// Click World`);
});
