import { promises as fsPromises } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import { devices } from 'playwright';
import type { Config, ToolCapability } from '../config.js';
import { sanitizeForFilePath } from './utils.js';
export type CLIOptions = {
  allowedOrigins?: string[];
  blockedOrigins?: string[];
  blockServiceWorkers?: boolean;
  browser?: string;
  caps?: string[];
  cdpEndpoint?: string;
  config?: string;
  device?: string;
  executablePath?: string;
  headless?: boolean;
  host?: string;
  ignoreHttpsErrors?: boolean;
  isolated?: boolean;
  imageResponses?: 'allow' | 'omit';
  sandbox?: boolean;
  outputDir?: string;
  port?: number;
  proxyBypass?: string;
  proxyServer?: string;
  saveSession?: boolean;
  saveTrace?: boolean;
  storageState?: string;
  userAgent?: string;
  userDataDir?: string;
  viewportSize?: string;
};
const defaultConfig: FullConfig = {
  browser: {
    browserName: 'chromium',
    launchOptions: {
      channel: 'chrome',
      headless: platform() === 'linux' && !process.env.DISPLAY,
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
  saveTrace: false,
};
type BrowserUserConfig = NonNullable<Config['browser']>;
export type FullConfig = Config & {
  browser: Omit<BrowserUserConfig, 'browserName'> & {
    browserName: 'chromium' | 'firefox' | 'webkit';
    launchOptions: NonNullable<BrowserUserConfig['launchOptions']>;
    contextOptions: NonNullable<BrowserUserConfig['contextOptions']>;
  };
  network: NonNullable<Config['network']>;
  saveTrace: boolean;
  server: NonNullable<Config['server']>;
};
export function resolveConfig(config: Config): FullConfig {
  return mergeConfig(defaultConfig, config);
}
export async function resolveCLIConfig(
  cliOptions: CLIOptions
): Promise<FullConfig> {
  const configInFile = await loadConfig(cliOptions.config);
  const envOverrides = configFromEnv();
  const cliOverrides = configFromCLIOptions(cliOptions);
  let result = defaultConfig;
  result = mergeConfig(result, configInFile);
  result = mergeConfig(result, envOverrides);
  result = mergeConfig(result, cliOverrides);
  return result;
}
type BrowserParseResult = {
  browserName: 'chromium' | 'firefox' | 'webkit' | undefined;
  channel: string | undefined;
};

function parseBrowserType(browser: string): BrowserParseResult {
  if (isChromiumVariant(browser)) {
    return { browserName: 'chromium', channel: browser };
  }

  if (browser === 'firefox') {
    return { browserName: 'firefox', channel: undefined };
  }

  if (browser === 'webkit') {
    return { browserName: 'webkit', channel: undefined };
  }

  return { browserName: undefined, channel: undefined };
}

export function isChromiumVariant(browser: string): boolean {
  const chromiumVariants = [
    'chrome',
    'chrome-beta',
    'chrome-canary',
    'chrome-dev',
    'chromium',
    'msedge',
    'msedge-beta',
    'msedge-canary',
    'msedge-dev',
  ];

  return chromiumVariants.includes(browser);
}

function createLaunchOptions(
  cliOptions: CLIOptions,
  channel?: string
): LaunchOptions {
  const launchOptions: LaunchOptions = {
    channel,
    executablePath: cliOptions.executablePath,
    headless: cliOptions.headless,
  };

  applySandboxSettings(launchOptions, cliOptions);
  applyProxySettings(launchOptions, cliOptions);

  return launchOptions;
}

function applySandboxSettings(
  launchOptions: LaunchOptions,
  cliOptions: CLIOptions
): void {
  if (cliOptions.sandbox === false) {
    launchOptions.chromiumSandbox = false;
  }
}

function applyProxySettings(
  launchOptions: LaunchOptions,
  cliOptions: CLIOptions
): void {
  if (!cliOptions.proxyServer) {
    return;
  }

  launchOptions.proxy = {
    server: cliOptions.proxyServer,
    ...(cliOptions.proxyBypass && { bypass: cliOptions.proxyBypass }),
  };
}

function createContextOptions(cliOptions: CLIOptions): BrowserContextOptions {
  const contextOptions: BrowserContextOptions = cliOptions.device
    ? devices[cliOptions.device] || {}
    : {};

  applyStorageOptions(contextOptions, cliOptions);
  applyViewportOptions(contextOptions, cliOptions);
  applySecurityOptions(contextOptions, cliOptions);

  return contextOptions;
}

function applyStorageOptions(
  contextOptions: BrowserContextOptions,
  cliOptions: CLIOptions
): void {
  if (cliOptions.storageState) {
    contextOptions.storageState = cliOptions.storageState;
  }
}

function applyViewportOptions(
  contextOptions: BrowserContextOptions,
  cliOptions: CLIOptions
): void {
  if (cliOptions.userAgent) {
    contextOptions.userAgent = cliOptions.userAgent;
  }

  if (cliOptions.viewportSize) {
    contextOptions.viewport = parseViewportSize(cliOptions.viewportSize);
  }
}

function applySecurityOptions(
  contextOptions: BrowserContextOptions,
  cliOptions: CLIOptions
): void {
  if (cliOptions.ignoreHttpsErrors) {
    contextOptions.ignoreHTTPSErrors = true;
  }

  if (cliOptions.blockServiceWorkers) {
    contextOptions.serviceWorkers = 'block';
  }
}

function parseViewportSize(viewportSize: string): {
  width: number;
  height: number;
} {
  try {
    const [width, height] = viewportSize.split(',').map((n) => +n);
    if (Number.isNaN(width) || Number.isNaN(height)) {
      throw new Error('bad values');
    }
    return { width, height };
  } catch (_error) {
    throw new Error(
      'Invalid viewport size format: use "width,height", for example --viewport-size="800,600"'
    );
  }
}

function validateDeviceAndCDPOptions(cliOptions: CLIOptions): void {
  if (cliOptions.device && cliOptions.cdpEndpoint) {
    throw new Error('Device emulation is not supported with cdpEndpoint.');
  }
}

export function configFromCLIOptions(cliOptions: CLIOptions): Config {
  const browserInfo = getBrowserInfo(cliOptions);
  validateDeviceAndCDPOptions(cliOptions);

  return buildFinalConfig(cliOptions, browserInfo);
}

function buildFinalConfig(
  cliOptions: CLIOptions,
  browserInfo: BrowserParseResult
): Config {
  return assembleConfigFromParts(cliOptions, browserInfo);
}

function assembleConfigFromParts(
  cliOptions: CLIOptions,
  browserInfo: BrowserParseResult
): Config {
  const configParts = createAllConfigParts(cliOptions, browserInfo);
  return mergeAllConfigParts(configParts);
}

function createAllConfigParts(
  cliOptions: CLIOptions,
  browserInfo: BrowserParseResult
) {
  return {
    browserConfig: createBrowserConfig(
      cliOptions,
      browserInfo.browserName,
      browserInfo.channel
    ),
    serverConfig: createServerConfig(cliOptions),
    networkConfig: createNetworkConfig(cliOptions),
    miscConfig: createMiscellaneousConfig(cliOptions),
  };
}

function mergeAllConfigParts(configParts: {
  browserConfig: Pick<Config, 'browser'>;
  serverConfig: Pick<Config, 'server'>;
  networkConfig: Pick<Config, 'network'>;
  miscConfig: Pick<
    Config,
    | 'capabilities'
    | 'saveSession'
    | 'saveTrace'
    | 'outputDir'
    | 'imageResponses'
  >;
}): Config {
  return {
    ...configParts.browserConfig,
    ...configParts.serverConfig,
    ...configParts.networkConfig,
    ...configParts.miscConfig,
  };
}

function getBrowserInfo(cliOptions: CLIOptions): BrowserParseResult {
  return cliOptions.browser
    ? parseBrowserType(cliOptions.browser)
    : { browserName: undefined, channel: undefined };
}

function createMiscellaneousConfig(
  cliOptions: CLIOptions
): Pick<
  Config,
  'capabilities' | 'saveSession' | 'saveTrace' | 'outputDir' | 'imageResponses'
> {
  return {
    capabilities: cliOptions.caps as ToolCapability[],
    saveSession: cliOptions.saveSession,
    saveTrace: cliOptions.saveTrace,
    outputDir: cliOptions.outputDir,
    imageResponses: cliOptions.imageResponses,
  };
}

function createBrowserConfig(
  cliOptions: CLIOptions,
  browserName: 'chromium' | 'firefox' | 'webkit' | undefined,
  channel?: string
): Pick<Config, 'browser'> {
  const browser: Config['browser'] = {
    isolated: cliOptions.isolated,
    userDataDir: cliOptions.userDataDir,
    launchOptions: createLaunchOptions(cliOptions, channel),
    contextOptions: createContextOptions(cliOptions),
    cdpEndpoint: cliOptions.cdpEndpoint,
  };

  // Only include browserName if explicitly provided
  if (browserName !== undefined) {
    browser.browserName = browserName;
  }

  return { browser };
}

function createServerConfig(cliOptions: CLIOptions): Pick<Config, 'server'> {
  return {
    server: {
      port: cliOptions.port,
      host: cliOptions.host,
    },
  };
}

function createNetworkConfig(cliOptions: CLIOptions): Pick<Config, 'network'> {
  return {
    network: {
      allowedOrigins: cliOptions.allowedOrigins,
      blockedOrigins: cliOptions.blockedOrigins,
    },
  };
}
function configFromEnv(): Config {
  const options = buildEnvOptions();
  return configFromCLIOptions(options);
}

function buildEnvOptions(): CLIOptions {
  const options: CLIOptions = {};
  populateAllOptions(options);
  return options;
}

function populateAllOptions(options: CLIOptions): void {
  populateNetworkOptions(options);
  populateBrowserOptions(options);
  populateDeviceOptions(options);
  populateProxyOptions(options);
  populateOutputOptions(options);
  populateMiscellaneousOptions(options);
}

function populateNetworkOptions(options: CLIOptions): void {
  options.allowedOrigins = semicolonSeparatedList(
    process.env.PLAYWRIGHT_MCP_ALLOWED_ORIGINS
  );
  options.blockedOrigins = semicolonSeparatedList(
    process.env.PLAYWRIGHT_MCP_BLOCKED_ORIGINS
  );
  options.ignoreHttpsErrors = envToBoolean(
    process.env.PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS
  );
  options.host = envToString(process.env.PLAYWRIGHT_MCP_HOST);
  options.port = envToNumber(process.env.PLAYWRIGHT_MCP_PORT);
}

function populateBrowserOptions(options: CLIOptions): void {
  options.browser = envToString(process.env.PLAYWRIGHT_MCP_BROWSER);
  options.executablePath = envToString(
    process.env.PLAYWRIGHT_MCP_EXECUTABLE_PATH
  );
  options.headless = envToBoolean(process.env.PLAYWRIGHT_MCP_HEADLESS);
  options.sandbox = envToBoolean(process.env.PLAYWRIGHT_MCP_SANDBOX);
  options.isolated = envToBoolean(process.env.PLAYWRIGHT_MCP_ISOLATED);
  options.blockServiceWorkers = envToBoolean(
    process.env.PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS
  );
}

function populateDeviceOptions(options: CLIOptions): void {
  options.device = envToString(process.env.PLAYWRIGHT_MCP_DEVICE);
  options.viewportSize = envToString(process.env.PLAYWRIGHT_MCP_VIEWPORT_SIZE);
  options.userAgent = envToString(process.env.PLAYWRIGHT_MCP_USER_AGENT);
  options.userDataDir = envToString(process.env.PLAYWRIGHT_MCP_USER_DATA_DIR);
  options.storageState = envToString(process.env.PLAYWRIGHT_MCP_STORAGE_STATE);
}

function populateProxyOptions(options: CLIOptions): void {
  options.proxyServer = envToString(process.env.PLAYWRIGHT_MCP_PROXY_SERVER);
  options.proxyBypass = envToString(process.env.PLAYWRIGHT_MCP_PROXY_BYPASS);
}

function populateOutputOptions(options: CLIOptions): void {
  options.outputDir = envToString(process.env.PLAYWRIGHT_MCP_OUTPUT_DIR);
  options.saveTrace = envToBoolean(process.env.PLAYWRIGHT_MCP_SAVE_TRACE);
  if (process.env.PLAYWRIGHT_MCP_IMAGE_RESPONSES === 'omit') {
    options.imageResponses = 'omit';
  }
}

function populateMiscellaneousOptions(options: CLIOptions): void {
  options.caps = commaSeparatedList(process.env.PLAYWRIGHT_MCP_CAPS);
  options.cdpEndpoint = envToString(process.env.PLAYWRIGHT_MCP_CDP_ENDPOINT);
  options.config = envToString(process.env.PLAYWRIGHT_MCP_CONFIG);
}
async function loadConfig(configFile: string | undefined): Promise<Config> {
  if (!configFile) {
    return {};
  }

  try {
    const configContent = await fsPromises.readFile(configFile, 'utf8');
    validateConfigContent(configContent);
    const config = JSON.parse(configContent);
    sanitizeConfigIfNeeded(config);
    return config;
  } catch (error) {
    throw new Error(`Failed to load config file: ${configFile}, ${error}`);
  }
}

function validateConfigContent(configContent: string): void {
  // Validate config file size to prevent DoS
  if (configContent.length > 1024 * 1024) {
    // 1MB limit
    throw new Error('Configuration file too large');
  }

  // Check for dangerous patterns in config content
  if (
    configContent.includes('__proto__') ||
    configContent.includes('constructor')
  ) {
    throw new Error(
      'Configuration file contains potentially dangerous content'
    );
  }
}

function sanitizeConfigIfNeeded(config: unknown): void {
  // Sanitize config object to prevent prototype pollution
  if (config && typeof config === 'object') {
    sanitizeConfigObject(config as Record<string, unknown>);
  }
}

function sanitizeConfigObject(obj: Record<string, unknown>): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  // Remove dangerous properties
  const dangerousProps = ['__proto__', 'constructor', 'prototype'];
  for (const prop of dangerousProps) {
    if (prop in obj) {
      delete obj[prop];
    }
  }

  // Recursively sanitize nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      sanitizeConfigObject(value as Record<string, unknown>);
    }
  }
}
export async function outputFile(
  config: FullConfig,
  rootPath: string | undefined,
  name: string
): Promise<string> {
  const outputDir =
    config.outputDir ??
    (rootPath ? pathJoin(rootPath, '.playwright-mcp') : undefined) ??
    pathJoin(
      tmpdir(),
      'playwright-mcp-output',
      sanitizeForFilePath(new Date().toISOString())
    );
  await fsPromises.mkdir(outputDir, { recursive: true });
  const fileName = sanitizeForFilePath(name);
  return pathJoin(outputDir, fileName);
}
function pickDefined<T extends object>(obj: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj ?? {}).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}
function mergeConfig(base: FullConfig, overrides: Config): FullConfig {
  const browser = createMergedBrowserConfig(base, overrides);
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

function createMergedBrowserConfig(
  base: FullConfig,
  overrides: Config
): FullConfig['browser'] {
  const browser: FullConfig['browser'] = {
    ...pickDefined(base.browser),
    ...pickDefined(overrides.browser),
    browserName:
      overrides.browser?.browserName ?? base.browser?.browserName ?? 'chromium',
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

  handleNonChromiumChannel(browser);
  return browser;
}

function handleNonChromiumChannel(browser: FullConfig['browser']): void {
  if (browser.browserName !== 'chromium' && browser.launchOptions) {
    browser.launchOptions.channel = undefined;
  }
}
export function semicolonSeparatedList(
  value: string | undefined
): string[] | undefined {
  if (!value) {
    return;
  }
  return value.split(';').map((v) => v.trim());
}
export function commaSeparatedList(
  value: string | undefined
): string[] | undefined {
  if (!value) {
    return;
  }
  return value.split(',').map((v) => v.trim());
}
function envToNumber(value: string | undefined): number | undefined {
  if (!value) {
    return;
  }
  return +value;
}
function envToBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
}
function envToString(value: string | undefined): string | undefined {
  return value ? value.trim() : undefined;
}
