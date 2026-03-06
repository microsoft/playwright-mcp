import { expect, test } from '@playwright/test';

const mcpBundle = require('playwright-core/lib/mcpBundle');
const { installUnicodeSafeSerialization } = require('../cli.js');

function createTransport() {
  let serialized = '';
  const transport = Object.create(mcpBundle.StdioServerTransport.prototype);
  transport._stdout = {
    write(chunk: string) {
      serialized += chunk;
      return true;
    },
    once() {},
  };
  return {
    transport,
    readMessage: () => JSON.parse(serialized.trim()),
  };
}

test('sanitizes malformed unicode in outgoing stdio messages', async () => {
  installUnicodeSafeSerialization();
  const { transport, readMessage } = createTransport();

  await transport.send({
    jsonrpc: '2.0',
    id: 1,
    result: {
      content: [{ type: 'text', text: `before ${String.fromCharCode(0xD800)} after` }],
    },
  });

  expect(readMessage().result.content[0].text).toBe('before \uFFFD after');
});

test('preserves non-plain values that JSON.stringify already handles', async () => {
  installUnicodeSafeSerialization();
  const { transport, readMessage } = createTransport();

  await transport.send({
    jsonrpc: '2.0',
    id: 1,
    result: {
      when: new Date('2024-01-02T03:04:05.000Z'),
    },
  });

  expect(readMessage().result.when).toBe('2024-01-02T03:04:05.000Z');
});
