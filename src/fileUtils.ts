// @ts-nocheck
import os from 'node:os';
import path from 'node:path';
import type { FullConfig } from './config.js';
export function cacheDir() {
  let cacheDirectory: string;
  if (process.platform === 'linux') {
    cacheDirectory =
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  } else if (process.platform === 'darwin') {
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  } else if (process.platform === 'win32') {
    cacheDirectory =
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  return path.join(cacheDirectory, 'ms-playwright');
}
export function userDataDir(browserConfig: FullConfig['browser']) {
  return path.join(
    cacheDir(),
    'ms-playwright',
    `mcp-${browserConfig.launchOptions?.channel ?? browserConfig?.browserName}-profile`
  );
}
