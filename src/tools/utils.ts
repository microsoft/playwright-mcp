// @ts-ignore
import { asLocator } from 'playwright-core/lib/utils';
import type * as playwright from 'playwright';
import type { Tab } from '../tab.js';
export async function waitForCompletion<R>(tab: Tab, callback: () => Promise<R>): Promise<R> {
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
    void tab.waitForLoadState('load').then(waitCallback);
  };
  const onTimeout = () => {
    dispose();
    waitCallback();
  };
  tab.page.on('request', requestListener);
  tab.page.on('requestfinished', requestFinishedListener);
  tab.page.on('framenavigated', frameNavigateListener);
  const timeout = setTimeout(onTimeout, 10000);
  const dispose = () => {
    tab.page.off('request', requestListener);
    tab.page.off('requestfinished', requestFinishedListener);
    tab.page.off('framenavigated', frameNavigateListener);
    clearTimeout(timeout);
  };
  try {
    const result = await callback();
    if (!requests.size && !frameNavigated)
      waitCallback();
    await waitBarrier;
    await tab.waitForTimeout(1000);
    return result;
  } finally {
    dispose();
  }
}
export async function generateLocator(locator: playwright.Locator): Promise<string> {
  try {
    const { resolvedSelector } = await (locator as any)._resolveSelector();
    return asLocator('javascript', resolvedSelector);
  } catch (e) {
    throw new Error('Ref not found, likely because element was removed. Use browser_snapshot to see what elements are currently on the page.');
  }
}
export async function callOnPageNoTrace<T>(page: playwright.Page, callback: (page: playwright.Page) => Promise<T>): Promise<T> {
  return await (page as any)._wrapApiCall(() => callback(page), { internal: true });
}
