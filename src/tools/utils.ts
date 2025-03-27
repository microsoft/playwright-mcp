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
  const page = context.existingPage();
  const dismissFileChooser = context.hasFileChooser();
  await waitForCompletion(page, () => callback(page));
  if (dismissFileChooser)
    context.clearFileChooser();
  const result: ToolResult = snapshot ? await captureAriaSnapshot(context, page, status) : {
    content: [{ type: 'text', text: status }],
  };
  return result;
}

export async function captureAllFrameSnapshot(page: playwright.Page): Promise<string> {
  const snapshots = await Promise.all(page.frames().map(frame => frame.locator('html').ariaSnapshot({ ref: true })));
  const scopedSnapshots = snapshots.map((snapshot, frameIndex) => {
    if (frameIndex === 0)
      return snapshot;
    return snapshot.replaceAll('[ref=', `[ref=f${frameIndex}`);
  });
  return scopedSnapshots.join('\n');
}

export async function captureAriaSnapshot(context: Context, page: playwright.Page, status: string = ''): Promise<ToolResult> {
  const lines = [];
  if (status)
    lines.push(`${status}`);
  lines.push(
      '',
      `- Page URL: ${page.url()}`,
      `- Page Title: ${await page.title()}`
  );
  if (context.hasFileChooser())
    lines.push(`- There is a file chooser visible that requires browser_choose_file to be called`);
  lines.push(
      `- Page Snapshot`,
      '```yaml',
      await captureAllFrameSnapshot(page),
      '```',
      ''
  );
  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}
