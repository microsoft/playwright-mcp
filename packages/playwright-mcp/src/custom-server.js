/**
 * Custom server wrapper for Playwright MCP.
 * Adds custom tools (clipboard, find-text, paste, wait-for-element)
 * and domain enforcement on top of the standard Playwright MCP backend.
 */

// Use absolute paths to import internal Playwright modules that aren't in the
// package's "exports" field.
const path = require('path');
const playwrightDir = path.dirname(require.resolve('playwright/package.json'));
const mcpServer = require(path.join(playwrightDir, 'lib/mcp/sdk/server'));
const { resolveCLIConfig } = require(path.join(playwrightDir, 'lib/mcp/browser/config'));
const { contextFactory } = require(path.join(playwrightDir, 'lib/mcp/browser/browserContextFactory'));
const { BrowserServerBackend } = require(path.join(playwrightDir, 'lib/mcp/browser/browserServerBackend'));
const { setupExitWatchdog } = require(path.join(playwrightDir, 'lib/mcp/browser/watchdog'));

const { clipboardRead, clipboardWrite } = require('./tools/clipboard');
const { findText } = require('./tools/find-text');
const { paste } = require('./tools/paste');
const { waitForElement } = require('./tools/wait-for-element');
const { isAllowedUrl, isInteractionTool } = require('./domain-enforcement');

/** MCP tool definitions for custom tools (JSON Schema format). */
const CUSTOM_TOOLS = [
  {
    name: 'browser_clipboard_read',
    description: 'Read text from the browser clipboard using CDP. Requires a loaded page (not about:blank).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'Clipboard read', readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'browser_clipboard_write',
    description: 'Write text to the browser clipboard using CDP. Requires a loaded page (not about:blank).',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to write to the clipboard' } },
      required: ['text'],
    },
    annotations: { title: 'Clipboard write', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'browser_find_text',
    description: 'Find visible elements containing text, with bounding boxes and center coordinates. Useful for locating elements when CSS selectors are unknown.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to search for' },
        exact: { type: 'boolean', description: 'If true, match exact text only. Default false (case-insensitive substring match).' },
      },
      required: ['text'],
    },
    annotations: { title: 'Find text', readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'browser_paste',
    description: 'Instantly insert text into a focused element using CDP Input.insertText. Faster than typing and handles newlines correctly. Triggers proper input events for React/Vue apps.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the target element to focus' },
        text: { type: 'string', description: 'Text to paste (can contain newlines)' },
      },
      required: ['selector', 'text'],
    },
    annotations: { title: 'Paste text', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'browser_wait_for_element',
    description: 'Wait for an element to appear in the DOM, optionally with specific text content. Supports long timeouts up to 10 minutes with configurable polling.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        text: { type: 'string', description: 'Optional text the element must contain' },
        exact: { type: 'boolean', description: 'If true, match exact text only. Default false.' },
        timeout: { type: 'number', description: 'Max wait time in ms. Default 30000, max 600000 (10 minutes).' },
        pollInterval: { type: 'number', description: 'Poll interval in ms. Default 1000.' },
      },
      required: ['selector'],
    },
    annotations: { title: 'Wait for element', readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
];

const CUSTOM_TOOL_NAMES = new Set(CUSTOM_TOOLS.map(t => t.name));

/**
 * Wraps a BrowserServerBackend to add custom tools and domain enforcement.
 */
class WrappedBackend {
  constructor(config, browserContextFactory, allowedDomains) {
    this._inner = new BrowserServerBackend(config, browserContextFactory);
    this._allowedDomains = allowedDomains;
  }

  async initialize(clientInfo) {
    return this._inner.initialize(clientInfo);
  }

  async listTools() {
    const tools = await this._inner.listTools();
    return [...tools, ...CUSTOM_TOOLS];
  }

  async callTool(name, args, progress) {
    // --- Domain enforcement: pre-navigation check ---
    if (this._allowedDomains && name === 'browser_navigate') {
      if (args.url && !isAllowedUrl(args.url, this._allowedDomains)) {
        return {
          content: [{ type: 'text', text: `### Error\nNavigation blocked: "${args.url}" is not in the allowed domains (${this._allowedDomains.join(', ')})` }],
          isError: true,
        };
      }
    }

    // --- Domain enforcement: pre-action check for interaction tools ---
    if (this._allowedDomains && (isInteractionTool(name) || CUSTOM_TOOL_NAMES.has(name) && name !== 'browser_wait_for_element')) {
      const page = this._currentPage();
      if (page) {
        const url = page.url();
        if (url && url !== 'about:blank' && !isAllowedUrl(url, this._allowedDomains)) {
          return {
            content: [{ type: 'text', text: `### Error\nAction blocked: current page "${url}" is not in the allowed domains (${this._allowedDomains.join(', ')})` }],
            isError: true,
          };
        }
      }
    }

    // --- Custom tool dispatch ---
    if (CUSTOM_TOOL_NAMES.has(name)) {
      return this._handleCustomTool(name, args);
    }

    // --- Delegate to inner backend ---
    const result = await this._inner.callTool(name, args, progress);

    // --- Domain enforcement: post-navigation redirect check ---
    if (this._allowedDomains && name === 'browser_navigate') {
      const page = this._currentPage();
      if (page) {
        const finalUrl = page.url();
        if (finalUrl && !isAllowedUrl(finalUrl, this._allowedDomains)) {
          await page.goto('about:blank').catch(() => {});
          return {
            content: [{ type: 'text', text: `### Error\nNavigation redirected to blocked domain: "${finalUrl}". Page has been reset. Allowed domains: ${this._allowedDomains.join(', ')}` }],
            isError: true,
          };
        }
      }
    }

    return result;
  }

  serverClosed(server) {
    return this._inner.serverClosed?.(server);
  }

  /** Get the current page from the inner backend's context, or null. */
  _currentPage() {
    try {
      const tab = this._inner._context?.currentTab();
      return tab?.page || null;
    } catch {
      return null;
    }
  }

  /** Get the current page, throwing if none available. */
  _currentPageOrDie() {
    const tab = this._inner._context?.currentTabOrDie();
    return tab.page;
  }

  async _handleCustomTool(name, args) {
    try {
      const page = this._currentPageOrDie();

      switch (name) {
        case 'browser_clipboard_read': {
          const text = await clipboardRead(page);
          return { content: [{ type: 'text', text: `### Clipboard content\n${text}` }] };
        }

        case 'browser_clipboard_write': {
          await clipboardWrite(page, args.text);
          return { content: [{ type: 'text', text: `### Success\nWrote ${args.text.length} characters to clipboard` }] };
        }

        case 'browser_find_text': {
          const matches = await findText(page, args.text, args.exact || false);
          if (matches.length === 0)
            return { content: [{ type: 'text', text: `### No matches found\nNo visible elements containing "${args.text}" were found on the page.` }] };
          const summary = matches.map((m, i) =>
            `${i + 1}. <${m.tagName}> "${m.text}"${m.context ? ` (context: "${m.context}")` : ''}\n   Box: ${m.boundingBox.x},${m.boundingBox.y} ${m.boundingBox.width}x${m.boundingBox.height} | Center: ${m.center.x},${m.center.y}`
          ).join('\n');
          return { content: [{ type: 'text', text: `### Found ${matches.length} match(es)\n${summary}` }] };
        }

        case 'browser_paste': {
          await paste(page, args.selector, args.text);
          return { content: [{ type: 'text', text: `### Success\nPasted ${args.text.length} characters into "${args.selector}"` }] };
        }

        case 'browser_wait_for_element': {
          const result = await waitForElement(page, {
            selector: args.selector,
            text: args.text,
            exact: args.exact,
            timeout: args.timeout,
            pollInterval: args.pollInterval,
          });
          const msg = result.matchedText
            ? `Element "${args.selector}" found with text: "${result.matchedText}"`
            : `Element "${args.selector}" found`;
          return { content: [{ type: 'text', text: `### Success\n${msg}` }] };
        }

        default:
          return {
            content: [{ type: 'text', text: `### Error\nUnknown custom tool "${name}"` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Error\n${String(error)}` }],
        isError: true,
      };
    }
  }
}

/**
 * Start the custom MCP server.
 * @param {object} options - CLI options (from commander)
 * @param {string} version - Package version
 * @param {string[]} [allowedDomains] - Optional domain allowlist
 */
async function startCustomServer(options, version, allowedDomains) {
  setupExitWatchdog();

  if (options.vision) {
    console.error('The --vision option is deprecated, use --caps=vision instead');
    options.caps = 'vision';
  }
  if (options.caps?.includes('tracing'))
    options.caps.push('devtools');

  const config = await resolveCLIConfig(options);
  const browserCtxFactory = contextFactory(config);

  const factory = {
    name: 'Playwright',
    nameInConfig: 'playwright',
    version,
    create: () => new WrappedBackend(config, browserCtxFactory, allowedDomains),
  };

  await mcpServer.start(factory, config.server);
}

module.exports = { startCustomServer, WrappedBackend };
