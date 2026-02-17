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

test('browser_navigate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: `await page.goto('${server.HELLO_WORLD}');`,
    snapshot: expect.stringContaining(`generic [active] [ref=e1]: Hello, world!`),
  });
});

test('snapshot sanitizes lone Unicode surrogates', async ({ client, server }) => {
  // Lone surrogates (unpaired high/low surrogate code units) are valid in JS strings
  // but invalid in JSON per RFC 8259. They appear in real pages via DOM textContent
  // assignment and cause "no low surrogate in string" JSON parse errors.
  // This test verifies they are replaced with U+FFFD (replacement character).
  server.setContent('/', `
    <title>Surrogate Test</title>
    <div id="target">normal text</div>
    <script>
      // Inject a lone high surrogate (U+D800) and a lone low surrogate (U+DC00)
      // into the DOM — these are valid JS strings but invalid JSON.
      document.getElementById('target').textContent = '\uD800lone-high \uDC00lone-low normal';
    </script>
  `, 'text/html');

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // The snapshot must not contain bare surrogates — they must be replaced with U+FFFD.
  const text = (response as any).content[0].text as string;
  // Verify no bare high surrogates remain
  expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  // Verify no bare low surrogates remain
  expect(text).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  // Verify the replacement character is present in the snapshot section
  expect(text).toContain('\uFFFD');
});
