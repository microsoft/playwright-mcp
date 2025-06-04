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

/* eslint-disable no-console */

import net from 'net';

import { program } from 'commander';
import playwright from 'playwright';

import { HttpServer } from './httpServer.js';
import { packageJSON } from './package.js';

import type http from 'http';

export type LaunchBrowserRequest = {
  browserType: string;
  userDataDir: string;
  launchOptions: playwright.LaunchOptions;
  contextOptions: playwright.BrowserContextOptions;
};

export type BrowserInfo = {
  browserType: string;
  userDataDir: string;
  cdpPort: number;
  launchOptions: playwright.LaunchOptions;
  contextOptions: playwright.BrowserContextOptions;
  error?: string;
};

type BrowserEntry = {
  browser?: playwright.Browser;
  info: BrowserInfo;
};

class BrowserServer {
  private _server = new HttpServer();
  private _entries: BrowserEntry[] = [];

  constructor() {
    this._setupExitHandler();
  }

  async start(port: number) {
    await this._server.start({ port });
    this._server.routePath('/json/list', (req, res) => {
      this._handleJsonList(res);
    });
    this._server.routePath('/json/launch', async (req, res) => {
      void this._handleLaunchBrowser(req, res).catch(e => console.error(e));
    });
    this._setEntries([]);
  }

  private _handleJsonList(res: http.ServerResponse) {
    const list = this._entries.map(browser => browser.info);
    res.end(JSON.stringify(list));
  }

  private async _handleLaunchBrowser(req: http.IncomingMessage, res: http.ServerResponse) {
    const request = await readBody<LaunchBrowserRequest>(req);
    let info = this._entries.map(entry => entry.info).find(info => info.userDataDir === request.userDataDir);
    if (!info || info.error)
      info = await this._newBrowser(request);
    res.end(JSON.stringify(info));
  }

  private async _newBrowser(request: LaunchBrowserRequest): Promise<BrowserInfo> {
    const cdpPort = await findFreePort();
    (request.launchOptions as any).cdpPort = cdpPort;
    const info: BrowserInfo = {
      browserType: request.browserType,
      userDataDir: request.userDataDir,
      cdpPort,
      launchOptions: request.launchOptions,
      contextOptions: request.contextOptions,
    };

    const browserType = playwright[request.browserType as 'chromium' | 'firefox' | 'webkit'];
    const { browser, error } = await browserType.launchPersistentContext(request.userDataDir, {
      ...request.launchOptions,
      ...request.contextOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
    }).then(context => {
      return { browser: context.browser()!, error: undefined };
    }).catch(error => {
      return { browser: undefined, error: error.message };
    });
    this._setEntries([...this._entries, {
      browser,
      info: {
        browserType: request.browserType,
        userDataDir: request.userDataDir,
        cdpPort,
        launchOptions: request.launchOptions,
        contextOptions: request.contextOptions,
        error,
      },
    }]);
    browser?.on('disconnected', () => {
      this._setEntries(this._entries.filter(entry => entry.browser !== browser));
    });
    return info;
  }

  private _updateReport() {
    // Clear the current line and move cursor to top of screen
    process.stdout.write('\x1b[2J\x1b[H');
    process.stdout.write(`Playwright Browser Server v${packageJSON.version}\n`);
    process.stdout.write(`Listening on ${this._server.urlPrefix('human-readable')}\n\n`);

    if (this._entries.length === 0) {
      process.stdout.write('No browsers currently running\n');
      return;
    }

    process.stdout.write('Running browsers:\n');
    for (const entry of this._entries) {
      const status = entry.browser ? 'running' : 'error';
      const statusColor = entry.browser ? '\x1b[32m' : '\x1b[31m'; // green for running, red for error
      process.stdout.write(`${statusColor}${entry.info.browserType}\x1b[0m (${entry.info.userDataDir}) - ${statusColor}${status}\x1b[0m\n`);
      if (entry.info.error)
        process.stdout.write(`  Error: ${entry.info.error}\n`);
    }

  }

  private _setEntries(entries: BrowserEntry[]) {
    this._entries = entries;
    this._updateReport();
  }

  private _setupExitHandler() {
    let isExiting = false;
    const handleExit = async () => {
      if (isExiting)
        return;
      isExiting = true;
      setTimeout(() => process.exit(0), 15000);
      for (const entry of this._entries)
        await entry.browser?.close().catch(() => {});
      process.exit(0);
    };

    process.stdin.on('close', handleExit);
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
  }
}

program
    .name('browser-agent')
    .option('-p, --port <port>', 'Port to listen on', '9224')
    .action(async options => {
      await main(options);
    });

void program.parseAsync(process.argv);

async function main(options: { port: string }) {
  const server = new BrowserServer();
  await server.start(+options.port);
}

function readBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
  });
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}
