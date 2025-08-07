// @ts-ignore
import { asLocator } from 'playwright-core/lib/utils';
import type * as playwright from 'playwright';
import type { Tab } from '../tab.js';
export async function waitForCompletion<R>(tab: Tab, callback: () => Promise<R>): Promise<R> {
  const requests = new Set<playwright.Request>();
  let frameNavigated = false;
  let navigationCompleted = false;
  let waitCallback: () => void = () => {};
  const waitBarrier = new Promise<void>(f => { waitCallback = f; });
  const requestListener = (request: playwright.Request) => requests.add(request);
  const requestFinishedListener = (request: playwright.Request) => {
    requests.delete(request);
    if (!requests.size && navigationCompleted)
      waitCallback();
  };
  const frameNavigateListener = (frame: playwright.Frame) => {
    if (frame.parentFrame())
      return;
    frameNavigated = true;

    // Enhanced navigation handling with stability checks
    void (async () => {
      try {
        await tab.waitForLoadState('load');
        await tab.waitForLoadState('networkidle', { timeout: getNavigationConfig().networkIdleTimeout }).catch(() => {});
        navigationCompleted = true;
        if (!requests.size)
          waitCallback();
      } catch (error) {
        // Fallback if load states fail
        navigationCompleted = true;
        waitCallback();
      }
    })();
  };
  const onTimeout = () => {
    dispose();
    navigationCompleted = true;
    waitCallback();
  };
  tab.page.on('request', requestListener);
  tab.page.on('requestfinished', requestFinishedListener);
  tab.page.on('framenavigated', frameNavigateListener);
  const timeout = setTimeout(onTimeout, getNavigationConfig().completionTimeout);
  const dispose = () => {
    tab.page.off('request', requestListener);
    tab.page.off('requestfinished', requestFinishedListener);
    tab.page.off('framenavigated', frameNavigateListener);
    clearTimeout(timeout);
  };
  try {
    const result = await callback();
    if (!requests.size && !frameNavigated) {
      navigationCompleted = true;
      waitCallback();
    }
    await waitBarrier;
    // Additional stability wait with context verification
    if (frameNavigated) {
      await tab.waitForTimeout(getNavigationConfig().stabilityWait);
      // Verify page is still responsive
      try {
        await tab.page.evaluate(() => document.readyState);
      } catch (error) {
        // Context might be destroyed, but we still return the result
      }
    } else {
      await tab.waitForTimeout(getNavigationConfig().defaultWait);
    }
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

function getNavigationConfig() {
  return {
    networkIdleTimeout: 2000,
    completionTimeout: 15000,
    stabilityWait: 1500,
    defaultWait: 1000
  };
}
