/**
 * Find visible elements by text content with bounding boxes.
 * Uses TreeWalker for efficient DOM traversal.
 */

/**
 * Find all visible elements containing the given text.
 * @param {import('playwright-core').Page} page
 * @param {string} text - Text to search for
 * @param {boolean} exact - If true, match exact text only
 * @returns {Promise<Array>} Matches with text, context, tagName, boundingBox, center
 */
async function findText(page, text, exact = false) {
  return page.evaluate(({ searchText, exactMatch }) => {
    function normalizeWhitespace(str) {
      return str.replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ').replace(/ {2,}/g, ' ');
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );

    const normalizedSearch = normalizeWhitespace(searchText);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent.trim();
      if (!nodeText) continue;

      const normalizedNode = normalizeWhitespace(nodeText);
      const isMatch = exactMatch
        ? normalizedNode === normalizedSearch
        : normalizedNode.toLowerCase().includes(normalizedSearch.toLowerCase());

      if (isMatch && node.parentElement) {
        const el = node.parentElement;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);

        if (rect.width === 0 || rect.height === 0 ||
            style.visibility === 'hidden' ||
            style.display === 'none') continue;

        const parent = el.parentElement;
        const context = parent ? parent.textContent.trim().slice(0, 100) : nodeText;

        matches.push({
          text: nodeText,
          context: context !== nodeText ? context : null,
          tagName: el.tagName.toLowerCase(),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          center: {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2),
          },
        });
      }
    }
    return matches;
  }, { searchText: text, exactMatch: exact });
}

module.exports = { findText };
