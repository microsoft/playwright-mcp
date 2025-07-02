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

import fs from 'fs';
import os from 'os';
import path from 'path';
import { devices } from 'playwright';

import type { Config as PublicConfig, ToolCapability } from '../config.js';
import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import { sanitizeForFilePath } from './tools/utils.js';

type Config = PublicConfig & {
  /**
   * TODO: Move to PublicConfig once we are ready to release this feature.
   * Run server that is able to connect to the 'Playwright MCP' Chrome extension.
   */
  extension?: boolean;
};

export type CLIOptions = {
  allowedOrigins?: string[];
  blockedOrigins?: string[];
  blockServiceWorkers?: boolean;
  browser?: string;
  browserAgent?: string;
  caps?: string;
  cdpEndpoint?: string;
  config?: string;
  device?: string;
  executablePath?: string;
  headless?: boolean;
  host?: string;
  ignoreHttpsErrors?: boolean;
  isolated?: boolean;
  imageResponses?: 'allow' | 'omit' | 'auto';
  sandbox: boolean;
  outputDir?: string;
  port?: number;
  proxyBypass?: string;
  proxyServer?: string;
  saveTrace?: boolean;
  storageState?: string;
  userAgent?: string;
  userDataDir?: string;
  viewportSize?: string;
  vision?: boolean;
  extension?: boolean;
};

const defaultConfig: FullConfig = {
  browser: {
    browserName: 'chromium',
    launchOptions: {
      channel: 'chrome',
      headless: os.platform() === 'linux' && !process.env.DISPLAY,
      chromiumSandbox: true,
    },
    contextOptions: {
      viewport: null,
    },
  },
  network: {
    allowedOrigins: undefined,
    blockedOrigins: undefined,
  },
  server: {},
  outputDir: path.join(os.tmpdir(), 'playwright-mcp-output', sanitizeForFilePath(new Date().toISOString())),
};

type BrowserUserConfig = NonNullable<Config['browser']>;

export type FullConfig = Config & {
  browser: Omit<BrowserUserConfig, 'browserName'> & {
    browserName: 'chromium' | 'firefox' | 'webkit';
    launchOptions: NonNullable<BrowserUserConfig['launchOptions']>;
    contextOptions: NonNullable<BrowserUserConfig['contextOptions']>;
  },
  network: NonNullable<Config['network']>,
  outputDir: string;
  server: NonNullable<Config['server']>,
};

export async function resolveConfig(config: Config): Promise<FullConfig> {
  return mergeConfig(defaultConfig, config);
}

export async function resolveCLIConfig(cliOptions: CLIOptions): Promise<FullConfig> {
  const configInFile = await loadConfig(cliOptions.config);
  const cliOverrides = await configFromCLIOptions(cliOptions);
  const result = mergeConfig(mergeConfig(defaultConfig, configInFile), cliOverrides);
  // Derive artifact output directory from config.outputDir
  if (result.saveTrace)
    result.browser.launchOptions.tracesDir = path.join(result.outputDir, 'traces');
  return result;
}

export function validateConfig(config: Config) {
  if (config.extension) {
    if (config.browser?.browserName !== 'chromium')
      throw new Error('Extension mode is only supported for Chromium browsers.');
  }
}

export async function configFromCLIOptions(cliOptions: CLIOptions): Promise<Config> {
  let browserName: 'chromium' | 'firefox' | 'webkit' | undefined;
  let channel: string | undefined;
  switch (cliOptions.browser) {
    case 'chrome':
    case 'chrome-beta':
    case 'chrome-canary':
    case 'chrome-dev':
    case 'chromium':
    case 'msedge':
    case 'msedge-beta':
    case 'msedge-canary':
    case 'msedge-dev':
      browserName = 'chromium';
      channel = cliOptions.browser;
      break;
    case 'firefox':
      browserName = 'firefox';
      break;
    case 'webkit':
      browserName = 'webkit';
      break;
  }

  // Launch options
  const launchOptions: LaunchOptions = {
    channel,
    executablePath: cliOptions.executablePath,
    headless: cliOptions.headless,
  };

  // --no-sandbox was passed, disable the sandbox
  if (!cliOptions.sandbox)
    launchOptions.chromiumSandbox = false;

  if (cliOptions.proxyServer) {
    launchOptions.proxy = {
      server: cliOptions.proxyServer
    };
    if (cliOptions.proxyBypass)
      launchOptions.proxy.bypass = cliOptions.proxyBypass;
  }

  if (cliOptions.device && cliOptions.cdpEndpoint)
    throw new Error('Device emulation is not supported with cdpEndpoint.');
  if (cliOptions.device && cliOptions.extension)
    throw new Error('Device emulation is not supported with extension mode.');

  // Context options
  const contextOptions: BrowserContextOptions = cliOptions.device ? devices[cliOptions.device] : {};
  if (cliOptions.storageState)
    contextOptions.storageState = cliOptions.storageState;

  if (cliOptions.userAgent)
    contextOptions.userAgent = cliOptions.userAgent;

  if (cliOptions.viewportSize) {
    try {
      const [width, height] = cliOptions.viewportSize.split(',').map(n => +n);
      if (isNaN(width) || isNaN(height))
        throw new Error('bad values');
      contextOptions.viewport = { width, height };
    } catch (e) {
      throw new Error('Invalid viewport size format: use "width,height", for example --viewport-size="800,600"');
    }
  }

  if (cliOptions.ignoreHttpsErrors)
    contextOptions.ignoreHTTPSErrors = true;

  if (cliOptions.blockServiceWorkers)
    contextOptions.serviceWorkers = 'block';

  const result: Config = {
    browser: {
      browserAgent: cliOptions.browserAgent ?? process.env.PW_BROWSER_AGENT,
      browserName,
      isolated: cliOptions.isolated,
      userDataDir: cliOptions.userDataDir,
      launchOptions,
      contextOptions,
      cdpEndpoint: cliOptions.cdpEndpoint,
    },
    server: {
      port: cliOptions.port,
      host: cliOptions.host,
    },
    capabilities: cliOptions.caps?.split(',').map((c: string) => c.trim() as ToolCapability),
    vision: !!cliOptions.vision,
    extension: !!cliOptions.extension,
    network: {
      allowedOrigins: cliOptions.allowedOrigins,
      blockedOrigins: cliOptions.blockedOrigins,
    },
    saveTrace: cliOptions.saveTrace,
    outputDir: cliOptions.outputDir,
    imageResponses: cliOptions.imageResponses,
  };

  return result;
}

async function loadConfig(configFile: string | undefined): Promise<Config> {
  if (!configFile)
    return {};

  try {
    return JSON.parse(await fs.promises.readFile(configFile, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load config file: ${configFile}, ${error}`);
  }
}

export async function outputFile(config: FullConfig, name: string): Promise<string> {
  await fs.promises.mkdir(config.outputDir, { recursive: true });
  const fileName = sanitizeForFilePath(name);
  return path.join(config.outputDir, fileName);
}

function pickDefined<T extends object>(obj: T | undefined): Partial<T> {
  return Object.fromEntries(
      Object.entries(obj ?? {}).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

function mergeConfig(base: FullConfig, overrides: Config): FullConfig {
  const browser: FullConfig['browser'] = {
    ...pickDefined(base.browser),
    ...pickDefined(overrides.browser),
    browserName: overrides.browser?.browserName ?? base.browser?.browserName ?? 'chromium',
    isolated: overrides.browser?.isolated ?? base.browser?.isolated ?? false,
    launchOptions: {
      ...pickDefined(base.browser?.launchOptions),
      ...pickDefined(overrides.browser?.launchOptions),
      ...{ assistantMode: true },
    },
    contextOptions: {
      ...pickDefined(base.browser?.contextOptions),
      ...pickDefined(overrides.browser?.contextOptions),
    },
  };

  if (browser.browserName !== 'chromium' && browser.launchOptions)
    delete browser.launchOptions.channel;

  return {
    ...pickDefined(base),
    ...pickDefined(overrides),
    browser,
    network: {
      ...pickDefined(base.network),
      ...pickDefined(overrides.network),
    },
    server: {
      ...pickDefined(base.server),
      ...pickDefined(overrides.server),
    },
  } as FullConfig;
}
