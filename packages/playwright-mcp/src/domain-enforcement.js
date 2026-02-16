/**
 * Domain allowlist enforcement for Playwright MCP.
 * Controls which domains the browser can navigate to and interact with.
 */

/**
 * Check if a URL's domain is in the allowlist.
 * @param {string} url - URL to check
 * @param {string[]} allowedDomains - List of allowed domains
 * @returns {boolean}
 */
function isAllowedUrl(url, allowedDomains) {
  if (!url) return false;
  if (url === 'about:blank') return true;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return allowedDomains.some(allowed => {
      const a = allowed.toLowerCase();
      return hostname === a || hostname.endsWith('.' + a);
    });
  } catch {
    return false;
  }
}

/** Tools that require the current page to be on an allowed domain before execution. */
const INTERACTION_TOOLS = new Set([
  'browser_click',
  'browser_type',
  'browser_fill_form',
  'browser_hover',
  'browser_drag',
  'browser_press_key',
  'browser_select_option',
  'browser_file_upload',
  'browser_evaluate',
  'browser_run_code',
  // Custom tools that interact with the page
  'browser_clipboard_read',
  'browser_clipboard_write',
  'browser_paste',
  'browser_find_text',
]);

function isInteractionTool(name) {
  return INTERACTION_TOOLS.has(name);
}

module.exports = { isAllowedUrl, isInteractionTool };
