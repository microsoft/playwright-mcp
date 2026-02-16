# Agent Spec: Customize Playwright MCP Fork

This is a detailed spec/prompt to hand to an agent working in the `playwright-mcp` fork repo. The goal is to add custom tools and domain enforcement, then set up Docker Compose + Tailscale deployment.

---

## Context

You are working in a forked copy of `microsoft/playwright-mcp`. This repo is a **thin wrapper** around the Playwright library's MCP implementation. The key files are:

- `packages/playwright-mcp/cli.js` — CLI entry point, delegates to `playwright/lib/mcp/program`
- `packages/playwright-mcp/index.js` — exports `createConnection()` from `playwright/lib/mcp/index`
- `packages/playwright-mcp/config.d.ts` — TypeScript config types

The actual MCP tool handlers (browser_navigate, browser_click, etc.) live in the `playwright` npm dependency, NOT in this repo. You should NOT modify the playwright dependency — instead, extend at this wrapper layer.

The `createConnection(config)` function returns an MCP `Server` instance. You'll build a custom wrapper that creates the base server, then adds custom tools and wraps existing ones.

There is a sibling project at `/home/casey/repos/ai-browser-proxy` that has reference implementations you should study. It's an Express.js REST API for browser automation with Puppeteer that has features we want to port to this MCP server.

## Goals

1. Add custom MCP tools: clipboard read/write, find-text (with bounding boxes), paste (instant text insertion), wait-for-element (long timeout)
2. Add strict domain enforcement that wraps existing navigation/interaction tools
3. Add Docker Compose + Tailscale deployment matching the pattern in ai-browser-proxy

---

## Part 1: Custom Tools

### Architecture

Create a custom wrapper module at `packages/playwright-mcp/src/custom-tools.js` (or similar) that:

1. Calls `createConnection(config)` to get the base Playwright MCP server
2. Registers additional custom tools on the server
3. Wraps existing tools (especially `browser_navigate`) with domain enforcement

To get a CDPSession from Playwright (needed for clipboard and paste):
```javascript
const cdpSession = await page.context().newCDPSession(page);
```

### Tool: `browser_clipboard_read`

Read text from the browser clipboard. Uses CDP `Runtime.evaluate` with `userGesture: true` to bypass permission checks (critical for remote/headless browsers).

**Reference implementation**: `/home/casey/repos/ai-browser-proxy/lib/clipboard.js`

```
Input: {} (no parameters)
Output: { text: string }
```

**Implementation notes:**
- Page must not be `about:blank` — return error if so
- Bring tab to front first (`page.bringToFront()`)
- Use CDP session:
  ```javascript
  const client = await page.context().newCDPSession(page);
  const result = await client.send('Runtime.evaluate', {
    expression: 'navigator.clipboard.readText()',
    awaitPromise: true,
    userGesture: true,   // KEY: bypasses permission checks
    returnByValue: true
  });
  return result.result.value;
  ```

### Tool: `browser_clipboard_write`

Write text to the browser clipboard.

**Reference implementation**: `/home/casey/repos/ai-browser-proxy/lib/clipboard.js`

```
Input: { text: string }
Output: { success: true, textLength: number }
```

**Implementation notes:**
- Same CDP pattern, with `navigator.clipboard.writeText(text)`
- Escape the text properly with `JSON.stringify(text)` in the expression

### Tool: `browser_find_text`

Find all visible elements containing text, returning bounding boxes and center coordinates for clicking. This enables a reliable "find visible text → click at coordinates" workflow.

**Reference implementation**: `/home/casey/repos/ai-browser-proxy/lib/selectors.js`

```
Input: { text: string, exact?: boolean }
Output: { matches: Array<{ text, context, tagName, boundingBox: {x,y,width,height}, center: {x,y} }>, count: number }
```

**Implementation notes:**
- Uses `page.evaluate()` with a TreeWalker to find text nodes
- Normalizes whitespace (nbsp, Unicode spaces → regular spaces)
- Checks visibility: skip elements with `display:none`, `visibility:hidden`, zero dimensions
- Returns parent element's tag name, bounding box, center point
- `exact: false` (default) does case-insensitive substring match
- `exact: true` does exact normalized text match
- Returns surrounding context (parent text, up to 100 chars) for disambiguation

Full browser-side implementation to use in `page.evaluate()`:
```javascript
function(searchText, exactMatch) {
  function normalizeWhitespace(str) {
    return str.replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ').replace(/ {2,}/g, ' ');
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const normalizedSearch = normalizeWhitespace(searchText);
  const matches = [];
  let node;
  while (node = walker.nextNode()) {
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
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue;
      const parent = el.parentElement;
      const context = parent ? parent.textContent.trim().slice(0, 100) : nodeText;
      matches.push({
        text: nodeText,
        context: context !== nodeText ? context : null,
        tagName: el.tagName.toLowerCase(),
        boundingBox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        center: { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }
      });
    }
  }
  return matches;
}
```

### Tool: `browser_paste`

Instantly insert text into the focused element using CDP `Input.insertText`. Unlike `browser_type` or `browser_fill`, this handles newlines correctly and is instant.

**Reference implementation**: `/home/casey/repos/ai-browser-proxy/lib/paste.js`

```
Input: { selector: string, text: string }
Output: { success: true }
```

**Implementation notes:**
- Focus the element first: `await page.focus(selector)` or use Playwright locator
- Use CDP session: `await client.send('Input.insertText', { text })`
- This triggers proper input events for React/Vue apps
- Handles multiline text correctly (no Enter key simulation needed)

### Tool: `browser_wait_for_element`

Wait for an element (optionally containing specific text) to appear. Designed for long waits like AI completion generation.

**Reference implementation**: see `/home/casey/repos/ai-browser-proxy/proxy.js` — search for the `/wait-for-element` endpoint

```
Input: { selector: string, text?: string, exact?: boolean, timeout?: number, pollInterval?: number }
Output: { success: true, matchedText?: string }
```

**Implementation notes:**
- Default timeout: 30000ms (30s), max timeout: 600000ms (10 minutes)
- Default poll interval: 1000ms (1s)
- Polling loop: check for element existence, optionally check text content
- Text matching uses the same whitespace normalization as find-text
- Return the matched text if text matching was used
- If timeout exceeded, return an error with clear message

---

## Part 2: Domain Enforcement

Add strict domain allowlist enforcement that wraps navigation and interaction tools. This should be stronger than the existing `--allowed-origins` (which explicitly says it's not a security boundary and doesn't handle redirects).

**Reference implementation**: `/home/casey/repos/ai-browser-proxy/lib/security.js`

### Configuration

Add a new CLI option: `--allowed-domains <domains>` (comma-separated)
Environment variable: `ALLOWED_DOMAINS`

Example: `--allowed-domains chat.openai.com,gemini.google.com,notebooklm.google.com`

### Domain Matching Logic

```javascript
function isAllowedUrl(url, allowedDomains) {
  if (!url) return false;
  if (url === 'about:blank') return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowedDomains.some(allowed =>
      hostname === allowed || hostname.endsWith('.' + allowed)
    );
  } catch { return false; }
}
```

This matches exact domains and subdomains: `allowed=google.com` matches `google.com` and `notebooklm.google.com`.

### Three enforcement points

1. **Pre-navigation check**: Before `browser_navigate` executes, validate the target URL. Block with clear error if not allowed.

2. **Post-navigation check**: After navigation completes, check `page.url()` to catch redirects. If redirected to a disallowed domain, navigate to `about:blank` and return error.

3. **Pre-action check**: Before any interaction tool executes (click, type, fill, etc.), check that `page.url()` is on an allowed domain. Block if not.

### Wrapping approach

Wrap the existing tool handlers. When the MCP server receives a tool call:
- For `browser_navigate`: run pre-nav check → delegate to original handler → run post-nav check
- For interaction tools (`browser_click`, `browser_type`, `browser_fill_form`, `browser_hover`, `browser_drag`, `browser_press_key`, `browser_select_option`, `browser_file_upload`, `browser_evaluate`): run pre-action check → delegate to original handler
- For read-only tools (`browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, etc.): pass through without checks (or optionally add pre-action check)

---

## Part 3: Docker Compose + Tailscale Deployment

Create deployment files matching the pattern used in the sibling project. The pattern is:

### `docker-compose.yml`

```yaml
services:
  playwright-mcp:
    build: .
    container_name: playwright-mcp
    hostname: playwright-mcp
    networks:
      - services-net
    ports:
      - "3000:3000"
    environment:
      - PLAYWRIGHT_MCP_PORT=3000
      - PLAYWRIGHT_MCP_HOST=0.0.0.0
      - PLAYWRIGHT_MCP_CDP_ENDPOINT=http://host.docker.internal:9222
      - ALLOWED_DOMAINS=${ALLOWED_DOMAINS}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  tailscale:
    image: tailscale/tailscale:latest
    container_name: playwright-mcp-tailscale
    hostname: playwright-mcp-ts
    networks:
      - services-net
    environment:
      - TS_AUTHKEY=${TAILSCALE_AUTHKEY}
      - TS_STATE_DIR=/var/lib/tailscale
      - TS_SERVE_CONFIG=/config/serve.json
      - TS_USERSPACE=true
    volumes:
      - tailscale-state:/var/lib/tailscale
      - ./docker/tailscale:/config:ro
    depends_on:
      - playwright-mcp
    restart: unless-stopped
    profiles:
      - tailscale

networks:
  services-net:
    external: true

volumes:
  tailscale-state:
```

### `docker/tailscale/serve.json`

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://playwright-mcp:3000"
        }
      }
    }
  }
}
```

### `.env.example`

```
ALLOWED_DOMAINS=chat.openai.com,gemini.google.com
TAILSCALE_AUTHKEY=tskey-auth-...
```

### Dockerfile modifications

The existing Dockerfile builds its own Chromium. Since we're connecting to an existing Chrome via CDP, the image should be lighter — skip browser installation. Modify or create a new Dockerfile target that:

- Uses `node:22-slim` base (or keep multi-stage but skip the BROWSER stage)
- Installs dependencies with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- Adds `curl` for healthchecks
- Runs as non-root user
- Entrypoint: `node packages/playwright-mcp/cli.js --port 3000 --cdp-endpoint http://host.docker.internal:9222`

---

## Part 4: Verification

After implementation, verify:

1. **Build**: `npm install && npm run build` succeeds
2. **Custom tools work**: Start the server with `--cdp-endpoint ws://localhost:9222 --port 3000`, then test each tool via curl:
   ```bash
   # Test SSE connection
   curl http://localhost:3000/sse

   # Or use an MCP client to call tools
   ```
3. **Domain enforcement**:
   - `browser_navigate` to an allowed domain → succeeds
   - `browser_navigate` to a disallowed domain → blocked with clear error
   - Navigate to allowed domain that redirects to disallowed → caught, page reset to about:blank
   - `browser_click` on disallowed domain → blocked
4. **Docker**: `docker compose up` starts the service, healthcheck passes
5. **Tailscale**: `docker compose --profile tailscale up` exposes the MCP server, reachable from another Tailscale machine at `https://playwright-mcp-ts.<tailnet>/sse`

---

## Key Files to Study

Before making changes, read these files in the playwright-mcp repo:
- `packages/playwright-mcp/cli.js` — entry point
- `packages/playwright-mcp/index.js` — createConnection export
- `packages/playwright-mcp/config.d.ts` — config types
- `Dockerfile` — existing Docker build

And these reference files in the sibling project:
- `/home/casey/repos/ai-browser-proxy/lib/clipboard.js` — clipboard via CDP
- `/home/casey/repos/ai-browser-proxy/lib/selectors.js` — find-text with bounding boxes
- `/home/casey/repos/ai-browser-proxy/lib/paste.js` — instant text insertion via CDP
- `/home/casey/repos/ai-browser-proxy/lib/security.js` — domain allowlist enforcement
- `/home/casey/repos/ai-browser-proxy/docker-compose.yml` — Docker Compose pattern to follow
- `/home/casey/repos/ai-browser-proxy/docker/tailscale/serve.json` — Tailscale serve config pattern
