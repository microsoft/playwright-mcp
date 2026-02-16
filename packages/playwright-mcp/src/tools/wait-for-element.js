/**
 * Wait for an element to appear, optionally with specific text content.
 * Supports long timeouts with configurable polling intervals.
 */

const MAX_TIMEOUT = 600000; // 10 minutes
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_POLL_INTERVAL = 1000; // 1 second

/**
 * Wait for an element matching selector (and optionally text) to appear.
 * @param {import('playwright-core').Page} page
 * @param {object} params
 * @param {string} params.selector - CSS selector
 * @param {string} [params.text] - Optional text to match
 * @param {boolean} [params.exact] - Exact text matching (default false)
 * @param {number} [params.timeout] - Max wait time in ms (default 30000, max 600000)
 * @param {number} [params.pollInterval] - Poll interval in ms (default 1000)
 * @returns {Promise<{found: boolean, matchedText?: string}>}
 */
async function waitForElement(page, params) {
  const {
    selector,
    text,
    exact = false,
    timeout = DEFAULT_TIMEOUT,
    pollInterval = DEFAULT_POLL_INTERVAL,
  } = params;

  const effectiveTimeout = Math.min(Math.max(timeout, 0), MAX_TIMEOUT);
  const deadline = Date.now() + effectiveTimeout;

  while (Date.now() < deadline) {
    const result = await page.evaluate(({ sel, matchText, exactMatch }) => {
      const elements = document.querySelectorAll(sel);
      if (elements.length === 0) return null;

      if (!matchText) return { found: true };

      function normalizeWhitespace(str) {
        return str.replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ').replace(/ {2,}/g, ' ').trim();
      }

      const normalizedSearch = normalizeWhitespace(matchText);
      for (const el of elements) {
        const elText = normalizeWhitespace(el.textContent || '');
        const isMatch = exactMatch
          ? elText === normalizedSearch
          : elText.toLowerCase().includes(normalizedSearch.toLowerCase());
        if (isMatch)
          return { found: true, matchedText: elText.slice(0, 200) };
      }
      return null;
    }, { sel: selector, matchText: text, exactMatch: exact }).catch(() => null);

    if (result) return result;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise(r => setTimeout(r, Math.min(pollInterval, remaining)));
  }

  throw new Error(
    text
      ? `Timeout waiting for element "${selector}" with text "${text}" (${effectiveTimeout}ms)`
      : `Timeout waiting for element "${selector}" (${effectiveTimeout}ms)`
  );
}

module.exports = { waitForElement };
