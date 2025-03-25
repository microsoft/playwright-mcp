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

test('test tool list', async ({ server }) => {
  const list = await server.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  });

  expect(list).toEqual(expect.objectContaining({
    id: 1,
    result: expect.objectContaining({
      tools: [
        expect.objectContaining({
          name: 'browser_navigate',
        }),
        expect.objectContaining({
          name: 'browser_go_back',
        }),
        expect.objectContaining({
          name: 'browser_go_forward',
        }),
        expect.objectContaining({
          name: 'browser_snapshot',
        }),
        expect.objectContaining({
          name: 'browser_click',
        }),
        expect.objectContaining({
          name: 'browser_hover',
        }),
        expect.objectContaining({
          name: 'browser_type',
        }),
        expect.objectContaining({
          name: 'browser_press_key',
        }),
        expect.objectContaining({
          name: 'browser_wait',
        }),
        expect.objectContaining({
          name: 'browser_save_as_pdf',
        }),
        expect.objectContaining({
          name: 'browser_close',
        }),
        expect.objectContaining({
          name: 'browser_localStorage_get',
        }),
        expect.objectContaining({
          name: 'browser_localStorage_set',
        }),
        expect.objectContaining({
          name: 'browser_localStorage_remove',
        }),
        expect.objectContaining({
          name: 'browser_localStorage_clear',
        }),
        expect.objectContaining({
          name: 'browser_localStorage_getAll',
        }),
      ],
    }),
  }));
});

test('test resources list', async ({ server }) => {
  const list = await server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
  });

  expect(list).toEqual(expect.objectContaining({
    id: 2,
    result: expect.objectContaining({
      resources: [
        expect.objectContaining({
          uri: 'browser://console',
          mimeType: 'text/plain',
        }),
      ],
    }),
  }));
});

test('test browser_navigate', async ({ server }) => {
  const response = await server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
      },
    },
  });

  expect(response).toEqual(expect.objectContaining({
    id: 2,
    result: {
      content: [{
        type: 'text',
        text: `
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`,
      }],
    },
  }));
});

test('test browser_click', async ({ server }) => {
  await server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<html><title>Title</title><button>Submit</button></html>',
      },
    },
  });

  const response = await server.send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'browser_click',
      arguments: {
        element: 'Submit button',
        ref: 's1e4',
      },
    },
  });

  expect(response).toEqual(expect.objectContaining({
    id: 3,
    result: {
      content: [{
        type: 'text',
        text: `\"Submit button\" clicked

- Page URL: data:text/html,<html><title>Title</title><button>Submit</button></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - button \"Submit\" [ref=s2e4]
\`\`\`
`,
      }],
    },
  }));
});

test('test localStorage tools', async ({ server }) => {
  await server.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<html><title>Title</title><body>Test localStorage</body></html>',
      },
    },
  });

  // Test setItem
  const setResponse = await server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_localStorage_set',
      arguments: {
        key: 'testKey',
        value: 'testValue',
      },
    },
  });

  expect(setResponse).toEqual(expect.objectContaining({
    id: 2,
    result: {
      content: [{
        type: 'text',
        text: 'Set localStorage key "testKey" to "testValue"',
      }],
    },
  }));

  // Test getItem
  const getResponse = await server.send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'browser_localStorage_get',
      arguments: {
        key: 'testKey',
      },
    },
  });

  expect(getResponse).toEqual(expect.objectContaining({
    id: 3,
    result: {
      content: [{
        type: 'text',
        text: 'Retrieved "testKey" from localStorage: "testValue"',
      }],
    },
  }));

  // Test getAll
  const getAllResponse = await server.send({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'browser_localStorage_getAll',
      arguments: {},
    },
  });

  expect(getAllResponse).toEqual(expect.objectContaining({
    id: 4,
    result: {
      content: [{
        type: 'text',
        text: 'localStorage contents:\n{\n  "testKey": "testValue"\n}',
      }],
    },
  }));

  // Test removeItem
  const removeResponse = await server.send({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'browser_localStorage_remove',
      arguments: {
        key: 'testKey',
      },
    },
  });

  expect(removeResponse).toEqual(expect.objectContaining({
    id: 5,
    result: {
      content: [{
        type: 'text',
        text: 'Removed "testKey" from localStorage',
      }],
    },
  }));

  // Test clear
  const clearResponse = await server.send({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'browser_localStorage_clear',
      arguments: {},
    },
  });

  expect(clearResponse).toEqual(expect.objectContaining({
    id: 6,
    result: {
      content: [{
        type: 'text',
        text: 'Cleared all items from localStorage',
      }],
    },
  }));
});
