/**
 * Instant text insertion via CDP Input.insertText.
 * Unlike character-by-character typing, this inserts text instantly,
 * handles newlines correctly, and triggers proper input events for React/Vue apps.
 */

/**
 * Paste text into an element using CDP Input.insertText.
 * @param {import('playwright-core').Page} page
 * @param {string} selector - CSS selector for the target element
 * @param {string} text - Text to paste (can contain newlines)
 */
async function paste(page, selector, text) {
  await page.focus(selector);
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.insertText', { text });
  } finally {
    await client.detach().catch(() => {});
  }
}

module.exports = { paste };
