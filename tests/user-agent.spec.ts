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

test('test custom user agent', async ({ server }) => {
  const customUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15';

  const response = await server.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<html><title>Title</title><body><script>document.write(navigator.userAgent)</script></body></html>',
        userAgent: customUserAgent
      }
    }
  });

  expect(response).toEqual(expect.objectContaining({
    id: 1,
    result: {
      content: [{
        type: 'text',
        text: `
- Page URL: data:text/html,<html><title>Title</title><body><script>document.write(navigator.userAgent)</script></body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: ${customUserAgent}
\`\`\`
`,
      }],
    },
  }));
});
