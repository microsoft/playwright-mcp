# Electron Support Implementation Plan for Playwright MCP

## Executive Summary

This plan outlines the implementation approach for adding Electron application support to the official Playwright MCP server. The implementation leverages Playwright's existing experimental `_electron` API while extending the MCP abstraction layer to handle Electron-specific concepts like the main process and window management.

## Prior Art Analysis

### Existing Community Implementations

1. **[@hotnsoursoup/playwright-mcp-electron](https://github.com/LionChenA/playwright-electron-mcp)** - Fork adding:
   - `electron_evaluate` tool for main process execution
   - `electron_windows`, `electron_first_window`, `electron_browser_window` tools
   - Configuration via `browserName: 'electron'` with custom launchOptions

2. **[fracalo/electron-playwright-mcp](https://lobehub.com/mcp/fracalo-electron-playwright-mcp)** - Separate implementation:
   - Requires explicit app executable path
   - Allows manual + programmatic interaction simultaneously
   - Node.js 20+ requirement

3. **[GitHub Issue #994](https://github.com/microsoft/playwright-mcp/issues/994)** - Official feature request:
   - 7 thumbs-up reactions showing community demand
   - Closed prematurely due to contributor confusion about repo structure
   - Key use cases: VSCode extensions, desktop Electron apps

### Playwright Electron API (Experimental)

```typescript
const { _electron: electron } = require('playwright');
const app: ElectronApplication = await electron.launch({
  args: ['main.js'],
  executablePath: '/path/to/electron',
  cwd: '/app/directory',
  env: { /* environment vars */ },
  timeout: 30000,
  // Plus all BrowserContext options
});

// Core capabilities:
app.evaluate(fn)        // Execute in main process
app.firstWindow()       // Get first BrowserWindow as Page
app.windows()           // Get all windows as Page[]
app.browserWindow(page) // Get BrowserWindow for a Page
app.process()           // Get underlying Node.js ChildProcess
app.context()           // Get BrowserContext
```

**Important Constraint:** The `nodeCliInspect` fuse must remain enabled for Playwright to connect.

---

## Architecture Design

### Design Principles

1. **Minimal Invasiveness**: Extend existing abstractions rather than forking
2. **Feature Parity**: Electron windows should work with all existing browser tools
3. **Additive Capability**: New Electron-specific tools via capability system
4. **Backward Compatibility**: Zero impact on existing browser automation

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP Server Layer                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────────┐  │
│  │  Core Tools  │ Vision Tools │  PDF Tools   │  Electron Tools  │  │
│  └──────┬───────┴──────┬───────┴──────┬───────┴────────┬─────────┘  │
│         │              │              │                │            │
│  ┌──────┴──────────────┴──────────────┴────────────────┴─────────┐  │
│  │                    Context Provider Layer                      │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐  │  │
│  │  │   BrowserContextProvider │  │  ElectronContextProvider   │  │  │
│  │  │   (chromium/ff/webkit)   │  │  (ElectronApplication)     │  │  │
│  │  └────────────┬────────────┘  └─────────────┬───────────────┘  │  │
│  └───────────────┴─────────────────────────────┴─────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                       │                         │
           ┌───────────┴───────────┐ ┌───────────┴───────────┐
           │ playwright.chromium   │ │ playwright._electron  │
           │    .launch()          │ │    .launch()          │
           └───────────────────────┘ └───────────────────────┘
```

### Key Abstractions

**1. Context Provider Interface**
```typescript
interface ContextProvider {
  getPage(): Promise<Page>;
  getContext(): Promise<BrowserContext>;
  close(): Promise<void>;
}

interface ElectronContextProvider extends ContextProvider {
  getApplication(): ElectronApplication;
  evaluateMain<T>(fn: () => T): Promise<T>;
  getWindows(): Promise<Page[]>;
  getBrowserWindow(page: Page): Promise<JSHandle>;
}
```

**2. Configuration Extension**
```typescript
// Extend config.d.ts
export type Config = {
  browser?: {
    browserName?: 'chromium' | 'firefox' | 'webkit' | 'electron';

    // Existing options...

    // Electron-specific
    electron?: {
      /** Path to Electron executable (auto-detected if not specified) */
      executablePath?: string;
      /** Main script to launch (e.g., 'main.js', '.') */
      args?: string[];
      /** Working directory for the Electron app */
      cwd?: string;
      /** Environment variables for Electron process */
      env?: Record<string, string>;
      /** Window selection strategy: 'first' | 'all' | index */
      windowStrategy?: 'first' | 'all' | number;
    };
  };

  capabilities?: ToolCapability[];
};

// Add new capability
type ToolCapability = 'core' | 'core-tabs' | 'core-install' | 'vision'
                    | 'pdf' | 'testing' | 'tracing' | 'electron';
```

---

## Implementation Steps

### Phase 1: Core Infrastructure (in Playwright monorepo)

**Location:** `packages/playwright/src/mcp/`

#### Step 1.1: Create Electron Context Provider

**File:** `packages/playwright/src/mcp/browser/electronContextProvider.ts`

```typescript
import { _electron, ElectronApplication, Page, BrowserContext } from 'playwright-core';
import type { ElectronConfig } from '../config';

export class ElectronContextProvider {
  private _app: ElectronApplication | null = null;
  private _currentPage: Page | null = null;

  constructor(private readonly _config: ElectronConfig) {}

  async launch(): Promise<void> {
    this._app = await _electron.launch({
      args: this._config.args ?? ['.'],
      executablePath: this._config.executablePath,
      cwd: this._config.cwd,
      env: this._config.env,
      timeout: this._config.timeout ?? 30000,
      // Forward context options
      ...this._config.contextOptions,
    });

    // Get initial window based on strategy
    this._currentPage = await this._resolveWindow();
  }

  private async _resolveWindow(): Promise<Page> {
    const strategy = this._config.windowStrategy ?? 'first';
    if (strategy === 'first')
      return await this._app!.firstWindow();
    if (typeof strategy === 'number') {
      const windows = await this._app!.windows();
      if (strategy >= windows.length)
        throw new Error(`Window index ${strategy} out of bounds`);
      return windows[strategy];
    }
    // 'all' - return first, expose all via tools
    return await this._app!.firstWindow();
  }

  async getPage(): Promise<Page> {
    if (!this._currentPage)
      throw new Error('Electron app not launched');
    return this._currentPage;
  }

  async getContext(): Promise<BrowserContext> {
    return this._app!.context();
  }

  async evaluateMain<T>(fn: () => T): Promise<T> {
    return this._app!.evaluate(fn);
  }

  async getWindows(): Promise<Page[]> {
    return this._app!.windows();
  }

  async getBrowserWindow(page: Page): Promise<JSHandle> {
    return this._app!.browserWindow(page);
  }

  async close(): Promise<void> {
    await this._app?.close();
    this._app = null;
    this._currentPage = null;
  }
}
```

#### Step 1.2: Extend Program Configuration

**File:** `packages/playwright/src/mcp/program.ts` (modify)

Add CLI arguments:
```typescript
.option('--electron-app <path>', 'path to Electron app main script')
.option('--electron-cwd <path>', 'working directory for Electron app')
.option('--electron-executable <path>', 'path to Electron executable')
```

Add browser type handling:
```typescript
if (browserName === 'electron') {
  // Validate required config
  // Create ElectronContextProvider instead of browser launch
}
```

#### Step 1.3: Create Electron-Specific Tools

**File:** `packages/playwright/src/mcp/sdk/tools/electron.ts`

```typescript
export const electronTools: Tool[] = [
  {
    name: 'electron_evaluate',
    title: 'Evaluate in main process',
    description: 'Execute JavaScript in the Electron main process',
    capability: 'electron',
    parameters: {
      type: 'object',
      properties: {
        function: {
          type: 'string',
          description: 'JavaScript function to execute, e.g., "() => require(\'electron\').app.getPath(\'userData\')"'
        }
      },
      required: ['function']
    },
    handler: async (context, args) => {
      const result = await context.electron.evaluateMain(
        new Function(`return (${args.function})()`)
      );
      return { result: JSON.stringify(result, null, 2) };
    }
  },

  {
    name: 'electron_windows',
    title: 'List Electron windows',
    description: 'List all open Electron BrowserWindows',
    capability: 'electron',
    parameters: { type: 'object', properties: {} },
    handler: async (context) => {
      const windows = await context.electron.getWindows();
      const windowInfo = await Promise.all(windows.map(async (w, i) => ({
        index: i,
        title: await w.title(),
        url: w.url(),
      })));
      return { windows: windowInfo };
    }
  },

  {
    name: 'electron_select_window',
    title: 'Select Electron window',
    description: 'Switch to a different Electron window by index',
    capability: 'electron',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: 'Window index (0-based)' }
      },
      required: ['index']
    },
    handler: async (context, args) => {
      const windows = await context.electron.getWindows();
      if (args.index >= windows.length)
        throw new Error(`Window index ${args.index} out of bounds (${windows.length} windows)`);
      context.setCurrentPage(windows[args.index]);
      return { result: `Switched to window ${args.index}` };
    }
  },

  {
    name: 'electron_app_info',
    title: 'Get Electron app info',
    description: 'Get information about the Electron application',
    capability: 'electron',
    readonly: true,
    parameters: { type: 'object', properties: {} },
    handler: async (context) => {
      const info = await context.electron.evaluateMain(() => ({
        name: require('electron').app.getName(),
        version: require('electron').app.getVersion(),
        paths: {
          userData: require('electron').app.getPath('userData'),
          appData: require('electron').app.getPath('appData'),
          temp: require('electron').app.getPath('temp'),
        },
        isPackaged: require('electron').app.isPackaged,
      }));
      return { appInfo: info };
    }
  },

  {
    name: 'electron_ipc_send',
    title: 'Send IPC message',
    description: 'Send an IPC message from main process to renderer',
    capability: 'electron',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'IPC channel name' },
        args: { type: 'array', description: 'Arguments to send' }
      },
      required: ['channel']
    },
    handler: async (context, args) => {
      const page = await context.getPage();
      const bw = await context.electron.getBrowserWindow(page);
      await bw.evaluate((win, { channel, data }) => {
        win.webContents.send(channel, ...data);
      }, { channel: args.channel, data: args.args ?? [] });
      return { result: `Sent IPC message to channel: ${args.channel}` };
    }
  }
];
```

### Phase 2: Configuration & CLI Integration

#### Step 2.1: Update Type Definitions

**File:** `packages/playwright/src/mcp/config.d.ts` (in monorepo)
**File:** `/config.d.ts` (in this wrapper repo - sync)

Add Electron configuration types as shown in Architecture section.

#### Step 2.2: CLI Argument Processing

Add to program.ts argument parsing:
```typescript
// Electron-specific arguments
if (options.electronApp || config.browser?.browserName === 'electron') {
  config.browser = {
    ...config.browser,
    browserName: 'electron',
    electron: {
      args: options.electronApp ? [options.electronApp] : config.browser?.electron?.args,
      cwd: options.electronCwd || config.browser?.electron?.cwd,
      executablePath: options.electronExecutable || config.browser?.electron?.executablePath,
    }
  };
}
```

### Phase 3: Testing Infrastructure

#### Step 3.1: Create Test Electron App

**File:** `tests/electron-app/main.js`

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Test IPC handlers
ipcMain.handle('test-channel', async (event, arg) => {
  return `Received: ${arg}`;
});

ipcMain.handle('get-app-path', async () => {
  return app.getAppPath();
});
```

**File:** `tests/electron-app/preload.js`
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
```

**File:** `tests/electron-app/index.html`
```html
<!DOCTYPE html>
<html>
<head><title>Test Electron App</title></head>
<body>
  <h1 id="heading">Hello Electron</h1>
  <button id="test-btn" data-testid="test-button">Click Me</button>
  <div id="output"></div>
  <script>
    document.getElementById('test-btn').onclick = async () => {
      const result = await window.electronAPI.invoke('test-channel', 'hello');
      document.getElementById('output').textContent = result;
    };
  </script>
</body>
</html>
```

#### Step 3.2: Test Fixtures

**File:** `tests/fixtures.ts` (extend)

```typescript
type ElectronTestFixtures = {
  electronClient: Client;
  startElectronClient: (options?: { appPath?: string }) => Promise<{ client: Client }>;
};

export const electronTest = test.extend<ElectronTestFixtures>({
  startElectronClient: async ({ }, use, testInfo) => {
    const clients: Client[] = [];

    await use(async (options = {}) => {
      const appPath = options.appPath || path.join(__dirname, 'electron-app');
      const args = [
        '--browser=electron',
        `--electron-app=${appPath}`,
      ];

      const client = new Client({ name: 'electron-test', version: '1.0.0' });
      const transport = await createTransport(args, undefined, testInfo.outputPath('profiles'));
      await client.connect(transport.transport);
      clients.push(client);
      return { client };
    });

    await Promise.all(clients.map(c => c.close()));
  },

  electronClient: async ({ startElectronClient }, use) => {
    const { client } = await startElectronClient();
    await use(client);
  },
});
```

#### Step 3.3: Test Specs

**File:** `tests/electron.spec.ts`

```typescript
import { electronTest, expect } from './fixtures';

electronTest.describe('Electron support', () => {

  electronTest('can launch and take snapshot', async ({ electronClient }) => {
    const response = await electronClient.callTool({
      name: 'browser_snapshot',
      arguments: {},
    });
    expect(response).toHaveResponse({
      pageState: expect.stringContaining('Hello Electron'),
    });
  });

  electronTest('can click elements', async ({ electronClient }) => {
    // First take snapshot to get refs
    await electronClient.callTool({ name: 'browser_snapshot', arguments: {} });

    const response = await electronClient.callTool({
      name: 'browser_click',
      arguments: { element: 'test button', ref: 'e1' },
    });
    expect(response).not.toHaveResponse({ isError: true });
  });

  electronTest('electron_evaluate executes in main process', async ({ electronClient }) => {
    const response = await electronClient.callTool({
      name: 'electron_evaluate',
      arguments: {
        function: "() => require('electron').app.getName()"
      },
    });
    expect(response.content[0].text).toContain('electron-app');
  });

  electronTest('electron_windows lists windows', async ({ electronClient }) => {
    const response = await electronClient.callTool({
      name: 'electron_windows',
      arguments: {},
    });
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.windows).toHaveLength(1);
    expect(parsed.windows[0].title).toBe('Test Electron App');
  });

  electronTest('electron_app_info returns app details', async ({ electronClient }) => {
    const response = await electronClient.callTool({
      name: 'electron_app_info',
      arguments: {},
    });
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.appInfo.paths.userData).toBeDefined();
  });
});
```

### Phase 4: Documentation & Examples

#### Step 4.1: README Updates

Add to README.md:
```markdown
### Electron Application Support

Playwright MCP supports automating Electron desktop applications through Playwright's
experimental Electron API.

**Requirements:**
- Electron app must have `nodeCliInspect` fuse enabled (default)
- App executable path or source directory

**Usage:**

\`\`\`js
{
  "mcpServers": {
    "playwright-electron": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser=electron",
        "--electron-app=/path/to/your/app"
      ]
    }
  }
}
\`\`\`

**Configuration file:**
\`\`\`json
{
  "browser": {
    "browserName": "electron",
    "electron": {
      "args": ["."],
      "cwd": "/path/to/app",
      "executablePath": "/path/to/electron"
    }
  },
  "capabilities": ["electron"]
}
\`\`\`

**Electron-specific tools:**
- `electron_evaluate` - Execute code in main process
- `electron_windows` - List all BrowserWindows
- `electron_select_window` - Switch active window
- `electron_app_info` - Get app metadata
- `electron_ipc_send` - Send IPC messages
```

---

## Security Considerations

### 1. Main Process Access Control

**Risk:** `electron_evaluate` allows arbitrary code execution in main process.

**Mitigations:**
- Gate behind explicit `--caps=electron` capability flag
- Add optional `electron.allowMainProcessEval: boolean` config (default: true for testing, false for production)
- Log all main process evaluations for audit trail
- Consider sandboxed evaluation mode with allowlist

```typescript
// Config option
electron?: {
  // ...
  /** Restrict main process evaluation (default: false in production) */
  allowMainProcessEval?: boolean;
  /** Allowed require() modules in main process evaluation */
  allowedModules?: string[];
}
```

### 2. IPC Security

**Risk:** IPC tools could trigger unintended app behavior.

**Mitigations:**
- Document that IPC channels are app-specific
- Add optional `electron.allowedIpcChannels` config to restrict channels
- Log all IPC messages

### 3. File System Access

**Risk:** Electron apps often have Node.js integration, enabling file access.

**Mitigations:**
- Main process code runs in app's context (inherits app's security model)
- Document that file operations inherit Electron app permissions
- Consider adding `--electron-sandbox` mode with restricted capabilities

### 4. Path Validation

**Risk:** Arbitrary executable paths could launch malicious binaries.

**Mitigations:**
- Validate `executablePath` points to valid Electron binary
- Add checksum/signature verification option
- Log executable path at launch

### 5. Environment Variable Injection

**Risk:** Custom env vars could affect app behavior.

**Mitigations:**
- Document env var behavior
- Consider blocklist for sensitive env vars (e.g., `ELECTRON_RUN_AS_NODE`)

---

## Performance Considerations

### 1. Launch Time

**Issue:** Electron apps have longer startup time than browsers.

**Mitigations:**
- Increase default timeout for Electron launch (60s vs 30s)
- Add `--electron-timeout` CLI option
- Consider connection reuse for persistent workflows

### 2. Window Resolution Overhead

**Issue:** Multi-window apps need strategy for current window selection.

**Mitigations:**
- Default to `firstWindow()` (most common case)
- Lazy window enumeration (only when `electron_windows` called)
- Cache window list with TTL

### 3. Main Process Evaluation

**Issue:** Frequent `electron_evaluate` calls have IPC overhead.

**Mitigations:**
- Batch evaluations where possible
- Cache immutable results (app paths, version)
- Document performance implications

### 4. Memory Usage

**Issue:** Electron apps are memory-intensive.

**Mitigations:**
- Document memory requirements
- Add `electron_quit` tool for explicit cleanup
- Ensure proper cleanup on MCP server close

---

## Testability Strategy

### Unit Tests
- Mock ElectronApplication for tool handler tests
- Test configuration parsing
- Test window selection strategies

### Integration Tests
- Launch real Electron test app
- Exercise all Electron-specific tools
- Test window switching
- Test IPC communication

### Platform-Specific Testing
- Linux (CI primary)
- macOS (GUI tests)
- Windows (GUI tests)

### Edge Cases
- App with no windows initially
- App that creates windows dynamically
- App with multiple windows from start
- App that closes and reopens windows
- nodeCliInspect fuse disabled scenario

### CI Configuration

```yaml
# In playwright.config.ts
projects: [
  { name: 'chromium' },
  { name: 'firefox' },
  { name: 'webkit' },
  {
    name: 'electron',
    testMatch: '**/electron.spec.ts',
    use: {
      mcpBrowser: 'electron',
    },
  },
],
```

---

## Contribution Path

### Where to Contribute

The actual MCP implementation lives in the **Playwright monorepo**:
- **URL:** https://github.com/microsoft/playwright
- **Path:** `packages/playwright/src/mcp/`

This repository (`microsoft/playwright-mcp`) is a wrapper for testing and publishing.

### Suggested Contribution Steps

1. **Fork microsoft/playwright** (not playwright-mcp)

2. **Create feature branch:** `feat/mcp-electron-support`

3. **Implement in order:**
   - `packages/playwright/src/mcp/browser/electronContextProvider.ts` (new)
   - `packages/playwright/src/mcp/sdk/tools/electron.ts` (new)
   - `packages/playwright/src/mcp/program.ts` (modify)
   - `packages/playwright/src/mcp/config.d.ts` (modify)

4. **Add tests in playwright-mcp repo:**
   - Create `tests/electron-app/` test fixture
   - Create `tests/electron.spec.ts`

5. **Update documentation:**
   - README in both repos
   - Type documentation

### PR Guidelines

1. **Reference Issue #994** in commit messages and PR

2. **Breaking Changes:** None expected (additive feature)

3. **Experimental Flag:** Consider `--experimental-electron` initially

4. **Feature Flag:** Use capability system (`--caps=electron`)

5. **Test Coverage:**
   - All new tools must have tests
   - Cross-platform CI (Linux at minimum)

---

## Alternative Approaches Considered

### 1. Extension-Based Approach (Like Chrome Extension)

**Concept:** Create Electron-specific extension that injects into running apps.

**Pros:**
- Could connect to already-running Electron apps
- No need to launch app via MCP

**Cons:**
- Requires app modification or preload script injection
- Complex setup for users
- Security concerns with script injection

**Decision:** Not recommended for initial implementation. Could be Phase 2.

### 2. CDP Direct Connection

**Concept:** Connect via Chrome DevTools Protocol to Electron's renderer.

**Pros:**
- No Playwright Electron API dependency
- Could work with --remote-debugging-port

**Cons:**
- No main process access
- Would lose Electron-specific features
- Already supported via `--cdp-endpoint`

**Decision:** Already partially supported. Electron-native approach adds more value.

### 3. Separate Package

**Concept:** Create `@playwright/mcp-electron` as separate package.

**Pros:**
- Cleaner separation
- Independent versioning

**Cons:**
- Fragmented user experience
- Duplicate code
- Harder to maintain

**Decision:** Not recommended. Integration into main package is preferred.

---

## Success Metrics

1. **Functional Coverage:**
   - All 26 core browser tools work with Electron windows
   - 5 new Electron-specific tools implemented
   - Multi-window support working

2. **Test Coverage:**
   - 90%+ code coverage for new code
   - Tests passing on Linux CI
   - macOS/Windows manual validation

3. **Documentation:**
   - README updated with Electron section
   - All new tools documented
   - Configuration examples provided

4. **User Experience:**
   - Launch Electron app with single CLI flag
   - Existing workflows work without modification
   - Clear error messages for common issues

---

## Timeline Suggestion (No Dates)

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Core infrastructure (context provider, basic tools) | Medium |
| 2 | CLI integration, configuration | Low |
| 3 | Testing infrastructure | Medium |
| 4 | Documentation | Low |
| 5 | Review & iteration | Variable |

---

## Open Questions for Maintainers

1. **API Stability:** Should Electron support inherit Playwright's "experimental" status for the `_electron` API?

2. **Default Capability:** Should `electron` capability be included in `core` or require explicit opt-in?

3. **Extension Mode:** Interest in Electron equivalent of Chrome extension for connecting to running apps?

4. **Breaking Changes Policy:** Any concerns about adding `browserName: 'electron'` option?

5. **CI Resources:** Can Electron tests run on existing CI infrastructure (requires display for headed)?

---

## References

- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [ElectronApplication Class](https://playwright.dev/docs/api/class-electronapplication)
- [GitHub Issue #994](https://github.com/microsoft/playwright-mcp/issues/994)
- [Community Fork](https://github.com/LionChenA/playwright-electron-mcp)
- [Playwright MCP Source](https://github.com/microsoft/playwright/tree/main/packages/playwright/src/mcp)
