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

import fs from 'node:fs';
import path from 'node:path';
import type { Stream } from 'node:stream';
import url from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { TestInfo } from '@playwright/test';
import { expect as baseExpect, test as baseTest } from '@playwright/test';
import type { BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import type { Config } from '../config';
import { TestServer } from './testserver/index.ts';

// Top-level regex patterns for performance optimization
const PW_MCP_TEST_REGEX = /^pw:mcp:test /;
const USER_DATA_DIR_REGEX = /user data dir.*/;
const CODE_FRAME_START_REGEX = /^```js\n/;
const CODE_FRAME_END_REGEX = /\n```$/;
const _SECTION_HEADER_REGEX = /^## /gm;

export type TestOptions = {
  mcpBrowser: string | undefined;
  mcpMode: 'docker' | undefined;
};

type CDPServer = {
  endpoint: string;
  start: () => Promise<BrowserContext>;
};

type TestFixtures = {
  client: Client;
  startClient: (options?: {
    clientName?: string;
    args?: string[];
    config?: Config;
    roots?: { name: string; uri: string }[];
  }) => Promise<{ client: Client; stderr: () => string }>;
  wsEndpoint: string;
  cdpServer: CDPServer;
  server: TestServer;
  httpsServer: TestServer;
  mcpHeadless: boolean;
  mcpBrowser: string | undefined;
  mcpMode: 'docker' | undefined;
};

type WorkerFixtures = {
  _workerServers: { server: TestServer; httpsServer: TestServer };
};

// Default expectations for test cases
const DEFAULT_TEST_EXPECTATIONS = {
  includeSnapshot: true,
  includeConsole: true,
  includeDownloads: true,
  includeTabs: true,
  includeCode: true,
} as const;

interface ExpectationConfig {
  includeSnapshot?: boolean;
  includeConsole?: boolean;
  includeDownloads?: boolean;
  includeTabs?: boolean;
  includeCode?: boolean;
  [key: string]: unknown;
}

// Helper function to create base expectation configuration
function createBaseExpectation(
  existingExpectation: ExpectationConfig
): ExpectationConfig {
  const baseConfig = {
    includeSnapshot:
      existingExpectation?.includeSnapshot ??
      DEFAULT_TEST_EXPECTATIONS.includeSnapshot,
    includeConsole:
      existingExpectation?.includeConsole ??
      DEFAULT_TEST_EXPECTATIONS.includeConsole,
    includeDownloads:
      existingExpectation?.includeDownloads ??
      DEFAULT_TEST_EXPECTATIONS.includeDownloads,
    includeTabs:
      existingExpectation?.includeTabs ?? DEFAULT_TEST_EXPECTATIONS.includeTabs,
    includeCode:
      existingExpectation?.includeCode ?? DEFAULT_TEST_EXPECTATIONS.includeCode,
  };
  return { ...baseConfig, ...existingExpectation };
}

// Helper function to merge expectations with defaults
function mergeWithDefaultExpectations(
  existingExpectation: ExpectationConfig
): ExpectationConfig {
  return createBaseExpectation(existingExpectation);
}

// Helper function to wrap client.callTool with default expectations for tests
function wrapClientWithDefaultExpectations(client: Client): void {
  const originalCallTool = client.callTool.bind(client);
  client.callTool = (request: Parameters<Client['callTool']>[0]) => {
    // Ensure arguments object exists
    if (!request.arguments) {
      request.arguments = {};
    }

    // Add default expectation for tests if not specified
    if (request.arguments.expectation) {
      // Merge with defaults if expectation is partially specified
      request.arguments.expectation = mergeWithDefaultExpectations(
        request.arguments.expectation
      );
    } else {
      request.arguments.expectation = { ...DEFAULT_TEST_EXPECTATIONS };
    }
    return originalCallTool(request);
  };
}

// Helper function to prepare client arguments
function prepareClientArgs(
  options: { args?: string[]; config?: Config } | undefined,
  mcpHeadless: boolean,
  mcpBrowser: string | undefined,
  configDir: string,
  testInfo: TestInfo
): Promise<string[]> | string[] {
  const args: string[] = [];

  if (process.env.CI && process.platform === 'linux') {
    args.push('--no-sandbox');
  }
  if (mcpHeadless) {
    args.push('--headless');
  }
  if (mcpBrowser) {
    args.push(`--browser=${mcpBrowser}`);
  }
  if (options?.args) {
    args.push(...options.args);
  }

  if (options?.config) {
    return handleConfigFile(options.config, configDir, testInfo).then(
      (configPath) => {
        args.push(`--config=${configPath}`);
        return args;
      }
    );
  }

  return args;
}

// Helper function to handle config file creation
async function handleConfigFile(
  config: Config,
  configDir: string,
  testInfo: TestInfo
): Promise<string> {
  const configFile = testInfo.outputPath('config.json');
  await fs.promises.writeFile(configFile, JSON.stringify(config, null, 2));
  return path.relative(configDir, configFile);
}

// Helper function to create and configure client
function createAndConfigureClient(
  options:
    | { clientName?: string; roots?: { name: string; uri: string }[] }
    | undefined
): Client {
  const client = new Client(
    { name: options?.clientName ?? 'test', version: '1.0.0' },
    options?.roots
      ? { capabilities: { roots: { listChanged: true } } }
      : undefined
  );

  if (options?.roots) {
    client.setRequestHandler(ListRootsRequestSchema, () => {
      return {
        roots: options.roots || [],
      };
    });
  }

  return client;
}

export const test = baseTest.extend<TestFixtures, WorkerFixtures>({
  client: async ({ startClient }, use) => {
    const { client } = await startClient();
    wrapClientWithDefaultExpectations(client);
    await use(client);
  },

  startClient: async ({ mcpHeadless, mcpBrowser, mcpMode }, use, testInfo) => {
    const configDir = path.dirname(test.info().config.configFile ?? '.');
    let client: Client | undefined;

    await use(async (options) => {
      const argsResult = prepareClientArgs(
        options,
        mcpHeadless,
        mcpBrowser,
        configDir,
        testInfo
      );
      const args = Array.isArray(argsResult) ? argsResult : await argsResult;

      client = createAndConfigureClient(options);

      const { transport, stderr } = createTransport(
        args,
        mcpMode,
        testInfo.outputPath('ms-playwright')
      );
      let stderrBuffer = '';
      stderr?.on('data', (data) => {
        if (process.env.PWMCP_DEBUG) {
          process.stderr.write(data);
        }
        stderrBuffer += data.toString();
      });
      await client.connect(transport);
      await client.ping();

      wrapClientWithDefaultExpectations(client);

      return { client, stderr: () => stderrBuffer };
    });

    await client?.close();
  },

  wsEndpoint: async (
    { mcpHeadless: _mcpHeadless, mcpBrowser: _mcpBrowser, mcpMode: _mcpMode },
    use
  ) => {
    const browserServer = await chromium.launchServer();
    await use(browserServer.wsEndpoint());
    await browserServer.close();
  },

  cdpServer: async ({ mcpBrowser }, use, testInfo) => {
    test.skip(
      !['chrome', 'msedge', 'chromium'].includes(mcpBrowser ?? ''),
      'CDP is not supported for non-Chromium browsers'
    );

    let browserContext: BrowserContext | undefined;
    const port = 3200 + test.info().parallelIndex;
    await use({
      endpoint: `http://localhost:${port}`,
      start: async () => {
        browserContext = await chromium.launchPersistentContext(
          testInfo.outputPath('cdp-user-data-dir'),
          {
            channel: mcpBrowser,
            headless: true,
            args: [`--remote-debugging-port=${port}`],
          }
        );
        return browserContext;
      },
    });
    await browserContext?.close();
  },

  mcpHeadless: async ({ headless }, use) => {
    await use(headless);
  },

  mcpBrowser: ['chrome', { option: true }],

  mcpMode: [undefined, { option: true }],

  _workerServers: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires object destructuring pattern
    async ({}, use, workerInfo) => {
      const port = 8907 + workerInfo.workerIndex * 4;
      const server = await TestServer.create(port);

      const httpsPort = port + 1;
      const httpsServer = await TestServer.createHTTPS(httpsPort);

      await use({ server, httpsServer });

      await Promise.all([server.stop(), httpsServer.stop()]);
    },
    { scope: 'worker' },
  ],

  server: async ({ _workerServers }, use) => {
    _workerServers.server.reset();
    await use(_workerServers.server);
  },

  httpsServer: async ({ _workerServers }, use) => {
    _workerServers.httpsServer.reset();
    await use(_workerServers.httpsServer);
  },
});

function createTransport(
  args: string[],
  mcpMode: TestOptions['mcpMode'],
  profilesDir: string
): {
  transport: Transport;
  stderr: Stream | null;
} {
  // NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
  const __filename = url.fileURLToPath(import.meta.url);
  if (mcpMode === 'docker') {
    const dockerArgs = [
      'run',
      '--rm',
      '-i',
      '--network=host',
      '-v',
      `${test.info().project.outputDir}:/app/test-results`,
    ];
    const transport = new StdioClientTransport({
      command: 'docker',
      args: [...dockerArgs, 'playwright-mcp-dev:latest', ...args],
    });
    return {
      transport,
      stderr: transport.stderr,
    };
  }

  // Use secure environment settings consistent with SecureTestProcessManager
  const secureEnv = {
    ...process.env,
    DEBUG: 'pw:mcp:test',
    DEBUG_COLORS: '0',
    DEBUG_HIDE_DATE: '1',
    PWMCP_PROFILES_DIR_FOR_TEST: profilesDir,
    // Include secure environment variables
    NODE_ENV: 'test',
    HOME: process.env.HOME,
    USER: process.env.USER,
  };

  const transport = new StdioClientTransport({
    command: process.execPath, // Use secure node executable path
    args: [path.join(path.dirname(__filename), '../cli.js'), ...args],
    cwd: path.dirname(test.info().config.configFile!),
    stderr: 'pipe',
    env: secureEnv,
  });
  return {
    transport,
    stderr: transport.stderr ?? null,
  };
}

type Response = Awaited<ReturnType<Client['callTool']>>;

export const expect = baseExpect.extend({
  toHaveResponse(response: Response, object: Record<string, unknown>) {
    const parsed = parseResponse(response);
    const isNot = this.isNot;
    try {
      if (isNot) {
        expect(parsed).not.toMatchObject(object);
      } else {
        expect(parsed).toMatchObject(object);
      }
    } catch (e) {
      return {
        pass: isNot,
        message: () => e.message,
      };
    }
    return {
      pass: !isNot,
      message: () => '',
    };
  },
});

export function formatOutput(output: string): string[] {
  return output
    .split('\n')
    .map((line) =>
      line
        .replace(PW_MCP_TEST_REGEX, '')
        .replace(USER_DATA_DIR_REGEX, 'user data dir')
        .trim()
    )
    .filter(Boolean);
}

function parseResponse(response: Response) {
  const text = response.content[0].text;
  const sections = parseSections(text);

  const result = sections.get('Result');
  const code = sections.get('Ran Playwright code');
  const tabs = sections.get('Open tabs');
  const pageState = sections.get('Page state');
  const consoleMessages = sections.get('New console messages');
  const modalState = sections.get('Modal state');
  const downloads = sections.get('Downloads');
  const codeNoFrame = code
    ?.replace(CODE_FRAME_START_REGEX, '')
    .replace(CODE_FRAME_END_REGEX, '');
  const isError = response.isError;
  const attachments = response.content.slice(1);

  return {
    result,
    code: codeNoFrame,
    tabs,
    pageState,
    consoleMessages,
    modalState,
    downloads,
    isError,
    attachments,
  };
}

// Regex patterns at top level to comply with BiomeJS rules
const SECTION_REGEX = /^(##+ .+)$/gm;
const HEADER_CLEANUP_REGEX = /^#+\s*/;

function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();

  // Handle both ## and ### headers
  let match: RegExpExecArray | null;
  const sectionMatches: { header: string; index: number }[] = [];

  // Separate assignment from condition to comply with BiomeJS
  match = SECTION_REGEX.exec(text);
  while (match !== null) {
    sectionMatches.push({
      header: match[1].replace(HEADER_CLEANUP_REGEX, '').trim(),
      index: match.index,
    });
    match = SECTION_REGEX.exec(text);
  }

  for (let i = 0; i < sectionMatches.length; i++) {
    const currentSection = sectionMatches[i];
    const nextSection = sectionMatches[i + 1];

    const contentStart = text.indexOf('\n', currentSection.index) + 1;
    const contentEnd = nextSection ? nextSection.index : text.length;

    const content = text.substring(contentStart, contentEnd).trim();
    sections.set(currentSection.header, content);
  }

  return sections;
}
