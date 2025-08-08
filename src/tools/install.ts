import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { defineTool } from './tool.js';

const install = defineTool({
  capability: 'core-install',
  schema: {
    name: 'browser_install',
    title: 'Install the browser specified in the config',
    description:
      'Install the browser specified in the config. Call this if you get an error about the browser not being installed.',
    inputSchema: z.object({}),
    type: 'destructive',
  },
  handle: async (context, _params, response) => {
    const channel =
      context.config.browser?.launchOptions?.channel ??
      context.config.browser?.browserName ??
      'chrome';
    const cliUrl = import.meta.resolve('playwright/package.json');
    const cliPath = path.join(fileURLToPath(cliUrl), '..', 'cli.js');
    const child = fork(cliPath, ['install', channel], {
      stdio: 'pipe',
    });
    const output: string[] = [];
    child.stdout?.on('data', (data) => output.push(data.toString()));
    child.stderr?.on('data', (data) => output.push(data.toString()));
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install browser: ${output.join('')}`));
        }
      });
    });
    response.setIncludeTabs();
  },
});
export default [install];
