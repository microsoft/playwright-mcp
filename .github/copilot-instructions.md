# Copilot Instructions for Playwright MCP

## Project Overview

Playwright MCP is a **Model Context Protocol (MCP) server** that enables LLMs to interact with web pages through structured accessibility snapshots instead of screenshots. It's published as `@playwright/mcp` and integrated into Playwright's core (now in the [Playwright monorepo](https://github.com/microsoft/playwright) at `packages/playwright/src/mcp`).

The repo contains:
- **Root MCP tools**: Published npm package entry points (`index.js`, `cli.js`)
- **Extension**: A Chrome extension (`extension/`) allowing MCP to connect to existing browser sessions with user cookies/state
- **Tests**: Playwright Test suite in TypeScript verifying MCP tool behavior

## Architecture Essentials

### MCP Tool Execution Flow
- **Client → Tool Call**: An MCP client calls tools like `browser_navigate` or `browser_click` with JSON arguments
- **Response Format**: Each tool returns `{code, pageState}` - the code executed and resulting page accessibility snapshot
- **Page State**: YAML-formatted accessibility tree showing elements and their refs (e.g., `[ref=e1]`)
- **Real Playwright API**: Tools wrap actual Playwright API calls internally (e.g., `page.goto()`, `page.click()`)

### Two Deployment Modes

1. **Standalone MCP Server** (`--browser chrome`): MCP spins up its own Playwright browser
2. **Extension Mode** (`--extension`): MCP connects to an existing browser via Chrome DevTools Protocol (CDP) relay through the extension

### Extension Architecture (`extension/`)

The Chrome extension bridges browser tabs to the MCP server using a **two-layer WebSocket/CDP relay mechanism**:

**Layer 1: Browser → Extension (Chrome Debugger Protocol)**
- `background.ts` registers listeners on `chrome.debugger.onEvent` and `chrome.debugger.onDetach`
- When a tab is selected for connection, the extension calls `chrome.debugger.attach(debuggee, '1.3')` with the target `tabId`
- All CDP events from the attached tab (e.g., `Network.responseReceived`, `DOM.documentUpdated`) are captured

**Layer 2: Extension → MCP Server (WebSocket)**
- `RelayConnection` class manages the WebSocket connection to the MCP server
- Incoming CDP events are transformed into `forwardCDPEvent` messages and sent via WebSocket
- Incoming CDP commands from the MCP server (`forwardCDPCommand`) are forwarded to `chrome.debugger.sendCommand()`
- Message format: `{id, method: 'forwardCDPCommand'|'forwardCDPEvent', params: {sessionId, method, params}}`
- Error handling: Invalid JSON, missing tab, or detached debugger throw errors with descriptive messages

**Connection Flow** (`background.ts`)
1. User selects tab via extension UI → `_connectTab()` called
2. `_activeConnection` is set to the WebSocket relay
3. `RelayConnection.setTabId(tabId)` attaches the debugger
4. Extension displays `✓` badge and title "Connected to MCP client"
5. MCP server can now send CDP commands; all responses/events flow back through WebSocket

**Features**
- Allows authentication via `PLAYWRIGHT_MCP_EXTENSION_TOKEN` (bypasses approval dialogs)
- Built with React UI (`src/ui/`) for tab selection and connection status display
- Handles graceful disconnection: `_onDebuggerDetach` closes the WebSocket with reason
- Only one active connection at a time; new connections close previous ones

## Dependency Hierarchy

```
@playwright/mcp (this repo)
├─ playwright@1.58.0-alpha (production dependency)
├─ playwright-core@1.58.0-alpha (production dependency)
└─ @modelcontextprotocol/sdk (dev, for MCP types)

extension/
├─ React 18 + Vite (UI bundling)
├─ @types/chrome (Chrome Extension API types)
└─ No production dependencies (ships as static files)
```

**Critical**: Playwright MCP in this repo is a **facade**. Core MCP implementation lives in the Playwright monorepo. Updates to tool logic or MCP core are made there, then `npm run copy-config` syncs type definitions.

## Development & Testing Workflows

### Local Testing (Primary)
```bash
npm test                    # Run all tests (default: Chrome)
npm run ctest              # Chrome only (fastest)
npm run ftest              # Firefox only
npm run wtest              # WebKit only
```

### Docker Testing
```bash
npm run docker-build       # Build Docker image for isolated testing
npm run docker-run         # Start container with MCP server
npm run dtest              # Run tests against Docker MCP server
```

### Test Architecture
- **Fixtures** (`tests/fixtures.ts`): Sets up MCP client, test server (HTTP/HTTPS), and CDP server
- **StartClient**: Spawns MCP server process with args, establishes stdio transport
- **Test Format**: Each test calls `client.callTool()` with tool name and arguments, verifies `code` and `pageState` response
- **Example** (`tests/core.spec.ts`): `browser_navigate` expects response containing executed code + accessibility snapshot

### Extension Development
```bash
cd extension
npm run build              # Compile TS + React, outputs to dist/
npm run watch              # Continuous compilation for development
npm run test               # Run Playwright tests for extension
npm run clean              # Remove build artifacts
```

## Key Patterns & Conventions

### Test Patterns
- Tests use **fixtures** pattern (Playwright Test convention)
- Each test receives a `client` fixture (MCP Client instance) and `server` fixture (test HTTP server)
- Assertions check both response structure (`code`, `pageState`) and content
- Multi-tool workflows test sequences like navigate → wait → click

### MCP Tool Response Contract
```typescript
// Expected response structure
{
  code: string,           // Executed Playwright code (e.g., "await page.goto(...)")
  pageState: string,      // YAML accessibility snapshot of page
  errorText?: string,     // Error message if tool fails
  errorDetails?: string   // Stack trace or additional context
}
```

### Configuration Management
- MCP server accepts `--config <path>` pointing to JSON file with tool options
- Config file injected at test time: `args.push('--config=path/to/config.json')`
- Supports feature flags like `--caps vision` or `--caps pdf` for advanced capabilities

## Code Style & Commits

### TypeScript Standards
- ESLint config in [Playwright monorepo](https://github.com/microsoft/playwright/blob/main/eslint.config.mjs)
- Comments should improve readability; prefer self-documenting code
- Files require Apache 2.0 license header

### Commit Messages
Follow [Semantic Commit Messages](https://www.conventionalcommits.org/):
```
feat(extension): add tab filtering UI
fix(mcp): handle CDP timeout gracefully
test(core): add browser_navigate error cases
docs(README): update extension setup steps
```

Labels: `fix`, `feat`, `docs`, `test`, `devops`, `chore`

## Important Notes for Contributors

1. **Core MCP Logic is in Playwright Monorepo**: Bug fixes or new tools go to [microsoft/playwright](https://github.com/microsoft/playwright), not here
2. **Extension-Only Changes**: Use this repo for Chrome extension UI, relay logic, or packaging
3. **Hermetic Tests**: Tests must not depend on external services; use provided test servers
4. **No New Dependencies**: High bar for new packages; discuss with maintainers first
5. **All Changes Need Tests**: Except documentation-only updates

## Useful Commands Summary

```bash
npm test                          # Run tests
npm run update-readme            # Regenerate README from help text
npm run lint                     # Run linter (via update-readme)
cd extension && npm run build   # Build extension
npm run roll                    # Full cycle: copy config, lint, ready for publish
```

## File Reference Guide

| Path | Purpose |
|------|---------|
| [index.js](index.js) | Main MCP entry point (re-exports from Playwright) |
| [cli.js](cli.js) | CLI command handler |
| [tests/fixtures.ts](tests/fixtures.ts) | Test infrastructure (MCP client setup, servers) |
| [tests/core.spec.ts](tests/core.spec.ts) | Core MCP tool tests |
| [extension/src/background.ts](extension/src/background.ts) | Extension service worker (tab management, CDP relay) |
| [extension/src/relayConnection.ts](extension/src/relayConnection.ts) | CDP-to-WebSocket relay for extension |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines with Playwright monorepo details |
