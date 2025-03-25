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
import path from 'path';
import os from 'os';

import type * as playwright from 'playwright';
import type { ToolResult } from './tool';
import type { Context } from '../context';

async function waitForCompletion<R>(page: playwright.Page, callback: () => Promise<R>): Promise<R> {
  const requests = new Set<playwright.Request>();
  let frameNavigated = false;
  let waitCallback: () => void = () => {};
  const waitBarrier = new Promise<void>(f => { waitCallback = f; });

  const requestListener = (request: playwright.Request) => requests.add(request);
  const requestFinishedListener = (request: playwright.Request) => {
    requests.delete(request);
    if (!requests.size)
      waitCallback();
  };

  const frameNavigateListener = (frame: playwright.Frame) => {
    if (frame.parentFrame())
      return;
    frameNavigated = true;
    dispose();
    clearTimeout(timeout);
    void frame.waitForLoadState('load').then(() => {
      waitCallback();
    });
  };

  const onTimeout = () => {
    dispose();
    waitCallback();
  };

  page.on('request', requestListener);
  page.on('requestfinished', requestFinishedListener);
  page.on('framenavigated', frameNavigateListener);
  const timeout = setTimeout(onTimeout, 10000);

  const dispose = () => {
    page.off('request', requestListener);
    page.off('requestfinished', requestFinishedListener);
    page.off('framenavigated', frameNavigateListener);
    clearTimeout(timeout);
  };

  try {
    const result = await callback();
    if (!requests.size && !frameNavigated)
      waitCallback();
    await waitBarrier;
    await page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    return result;
  } finally {
    dispose();
  }
}

export async function runAndWait(context: Context, status: string, callback: (page: playwright.Page) => Promise<any>, snapshot: boolean = false): Promise<ToolResult> {
  const page = await context.existingPage();
  await waitForCompletion(page, () => callback(page));
  return snapshot ? captureAriaSnapshot(page, status) : {
    content: [{ type: 'text', text: status }],
  };
}

export async function captureAriaSnapshot(page: playwright.Page, status: string = ''): Promise<ToolResult> {
  const snapshot = await page.locator('html').ariaSnapshot({ ref: true });
  return {
    content: [{ type: 'text', text: `${status ? `${status}\n` : ''}
- Page URL: ${page.url()}
- Page Title: ${await page.title()}
- Page Snapshot
\`\`\`yaml
${snapshot}
\`\`\`
`
    }],
  };
}

export async function storageStateFolder() {
  let cacheDirectory: string;
  if (process.platform === 'linux')
    cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  else if (process.platform === 'darwin')
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  else if (process.platform === 'win32')
    cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  else
    throw new Error('Unsupported platform: ' + process.platform);
  const result = path.join(cacheDirectory, 'ms-playwright', 'mcp-storage');
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

export async function storageStatePath(origin: string): Promise<string> {
  const folder = await storageStateFolder();
  return path.join(folder, `${safeFilename(origin)}.json`);
}

export async function storageStatePathIfExists(origin: string): Promise<string | undefined> {
  const file = await storageStatePath(origin);
  if (!fs.existsSync(file))
    return undefined;
  return file;
}

function safeFilename(alias: string) {
  return alias.replace(/[^a-zA-Z0-9]/g, '_');
}
