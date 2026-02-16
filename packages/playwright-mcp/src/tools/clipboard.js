/**
 * Clipboard read/write via CDP Runtime.evaluate with userGesture: true.
 * Bypasses clipboard permission checks that fail with remote browsers.
 */

/**
 * Read text from the browser clipboard.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
async function clipboardRead(page) {
  if (page.url() === 'about:blank')
    throw new Error('Clipboard operations require a loaded page — navigate to a URL first');

  await page.bringToFront();
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: 'navigator.clipboard.readText()',
      awaitPromise: true,
      userGesture: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description || 'Clipboard read failed';
      throw new Error(msg);
    }
    return result.result.value;
  } finally {
    await client.detach().catch(() => {});
  }
}

/**
 * Write text to the browser clipboard.
 * @param {import('playwright-core').Page} page
 * @param {string} text
 */
async function clipboardWrite(page, text) {
  if (page.url() === 'about:blank')
    throw new Error('Clipboard operations require a loaded page — navigate to a URL first');

  await page.bringToFront();
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `navigator.clipboard.writeText(${JSON.stringify(text)})`,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description || 'Clipboard write failed';
      throw new Error(msg);
    }
  } finally {
    await client.detach().catch(() => {});
  }
}

module.exports = { clipboardRead, clipboardWrite };
