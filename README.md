## Playwright MCP

A Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev). This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

### Playwright MCP vs Playwright CLI

This package provides MCP interface into Playwright. If you are using a **coding agent**, you might benefit from using the [CLI+SKILLS](https://github.com/microsoft/playwright-cli) instead.

- **CLI**: Modern **coding agents** increasingly favor CLI–based workflows exposed as SKILLs over MCP because CLI invocations are more token-efficient: they avoid loading large tool schemas and verbose accessibility trees into the model context, allowing agents to act through concise, purpose-built commands. This makes CLI + SKILLs better suited for high-throughput coding agents that must balance browser automation with large codebases, tests, and reasoning within limited context windows.<br>**Learn more about [Playwright CLI with SKILLS](https://github.com/microsoft/playwright-cli)**.

- **MCP**: MCP remains relevant for specialized agentic loops that benefit from persistent state, rich introspection, and iterative reasoning over page structure, such as exploratory automation, self-healing tests, or long-running autonomous workflows where maintaining continuous browser context outweighs token cost concerns. **New:** MCP now supports [token optimization](https://github.com/microsoft/playwright-mcp#token-efficiency-for-agentic-workflows) via smart snapshot pruning (`--snapshot-mode pruned|focused`) and configurable tree depth/filtering to reduce accessibility tree verbosity by 45-80%, making it viable for high-throughput scenarios.

### Key Features

- **Fast and lightweight**. Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**. No vision models needed, operates purely on structured data.
- **Deterministic tool application**. Avoids ambiguity common with screenshot-based approaches.
- **Production-ready observability**. Structured logging with JSON output, environment-based configuration, and lifecycle event tracking for monitoring agentic workflows at scale.
- **Token-efficient**. Smart snapshot pruning and configurable tree depth reduce token usage by 45–80% on typical pages.

### Requirements

- Node.js 18 or newer
- VS Code, Cursor, Windsurf, Claude Desktop, Goose, Junie or any other MCP client

<!--
// Generate using:
node utils/generate-links.js
-->

### Getting started

First, install the Playwright MCP server with your client.

**Standard config** works in most of the tools:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

<details>
<summary>Amp</summary>

Add via the Amp VS Code extension settings screen or by updating your settings.json file:

```json
"amp.mcpServers": {
  "playwright": {
    "command": "npx",
    "args": [
      "@playwright/mcp@latest"
    ]
  }
}
```

**Amp CLI Setup:**

Add via the `amp mcp add`command below

```bash
amp mcp add playwright -- npx @playwright/mcp@latest
```

</details>

<details>
<summary>Antigravity</summary>

Add via the Antigravity settings or by updating your configuration file:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary>Claude Code</summary>

Use the Claude Code CLI to add the Playwright MCP server:

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Cline</summary>

Follow the instruction in the section [Configuring MCP Servers](https://docs.cline.bot/mcp/configuring-mcp-servers)

**Example: Local Setup**

Add the following to your [`cline_mcp_settings.json`](https://docs.cline.bot/mcp/configuring-mcp-servers#editing-mcp-settings-files) file:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "timeout": 30,
      "args": ["-y", "@playwright/mcp@latest"],
      "disabled": false
    }
  }
}
```

</details>

<details>
<summary>Codex</summary>

Use the Codex CLI to add the Playwright MCP server:

```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

Alternatively, create or edit the configuration file `~/.codex/config.toml` and add:

```toml
[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]
```

For more information, see the [Codex MCP documentation](https://github.com/openai/codex/blob/main/codex-rs/config.md#mcp_servers).

</details>

<details>
<summary>Copilot</summary>

Use the Copilot CLI to interactively add the Playwright MCP server:

```bash
/mcp add
```

Alternatively, create or edit the configuration file `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "local",
      "command": "npx",
      "tools": ["*"],
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

For more information, see the [Copilot CLI documentation](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

</details>

<details>
<summary>Cursor</summary>

#### Click the button to install:

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=Playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx @playwright/mcp@latest`. You can also verify config or add command like arguments via clicking `Edit`.

</details>

<details>
<summary>Factory</summary>

Use the Factory CLI to add the Playwright MCP server:

```bash
droid mcp add playwright "npx @playwright/mcp@latest"
```

Alternatively, type `/mcp` within Factory droid to open an interactive UI for managing MCP servers.

For more information, see the [Factory MCP documentation](https://docs.factory.ai/cli/configuration/mcp).

</details>

<details>
<summary>Gemini CLI</summary>

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

</details>

<details>
<summary>Goose</summary>

#### Click the button to install:

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=%40playwright%2Fmcp%40latest&id=playwright&name=Playwright&description=Interact%20with%20web%20pages%20through%20structured%20accessibility%20snapshots%20using%20Playwright)

#### Or install manually:

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx @playwright/mcp`. Click "Add Extension".

</details>

<details>
<summary>Junie</summary>

To add the Playwright MCP server in Junie CLI:

1. Type `/mcp`
2. Press `Ctrl+A` to add a new MCP server
3. Select **Playwright** from the list

Alternatively, add to `.junie/mcp/mcp.json`:

```json
{
  "mcpServers": {
    "Playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

For more information, see the [Junie MCP configuration documentation](https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html).

</details>

<details>
<summary>Kiro</summary>

[![Add to Kiro](https://kiro.dev/images/add-to-kiro.svg)](https://kiro.dev/launch/mcp/add?name=playwright&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40playwright%2Fmcp%40latest%22%5D%7D)

Follow the MCP Servers [documentation](https://kiro.dev/docs/mcp/). For example in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary>LM Studio</summary>

#### Click the button to install:

[![Add MCP Server playwright to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJAcGxheXdyaWdodC9tY3BAbGF0ZXN0Il19)

#### Or install manually:

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.

</details>

<details>
<summary>opencode</summary>

Follow the MCP Servers [documentation](https://opencode.ai/docs/mcp-servers/). For example in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

</details>

<details>
<summary>Qodo Gen</summary>

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ → Connect more tools → + Add new MCP → Paste the standard config above.

Click <code>Save</code>.

</details>

<details>
<summary>VS Code</summary>

#### Click the button to install:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

#### Or install manually:

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the Playwright MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

After installation, the Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.

</details>

<details>
<summary>Warp</summary>

Go to `Settings` -> `AI` -> `Manage MCP Servers` -> `+ Add` to [add an MCP Server](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server). Use the standard config above.

Alternatively, use the slash command `/add-mcp` in the Warp prompt and paste the standard config from above:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

</details>

<details>
<summary>Windsurf</summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

### Configuration

Playwright MCP server supports following arguments. They can be provided in the JSON configuration above, as a part of the `"args"` list:

<!--- Options generated by update-readme.js -->

| Option | Description |
|--------|-------------|
| --allowed-hosts <hosts...> | comma-separated list of hosts this server is allowed to serve from. Defaults to the host the server is bound to. Pass '*' to disable the host check.<br>*env* `PLAYWRIGHT_MCP_ALLOWED_HOSTS` |
| --allowed-origins <origins> | semicolon-separated list of TRUSTED origins to allow the browser to request. Default is to allow all. Important: *does not* serve as a security boundary and *does not* affect redirects.<br>*env* `PLAYWRIGHT_MCP_ALLOWED_ORIGINS` |
| --allow-unrestricted-file-access | allow access to files outside of the workspace roots. Also allows unrestricted access to file:// URLs. By default access to file system is restricted to workspace root directories (or cwd if no roots are configured) only, and navigation to file:// URLs is blocked.<br>*env* `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS` |
| --blocked-origins <origins> | semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed. Important: *does not* serve as a security boundary and *does not* affect redirects.<br>*env* `PLAYWRIGHT_MCP_BLOCKED_ORIGINS` |
| --block-service-workers | block service workers<br>*env* `PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS` |
| --browser <browser> | browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.<br>*env* `PLAYWRIGHT_MCP_BROWSER` |
| --caps <caps> | comma-separated list of additional capabilities to enable, possible values: vision, pdf, devtools.<br>*env* `PLAYWRIGHT_MCP_CAPS` |
| --cdp-endpoint <endpoint> | CDP endpoint to connect to.<br>*env* `PLAYWRIGHT_MCP_CDP_ENDPOINT` |
| --cdp-header <headers...> | CDP headers to send with the connect request, multiple can be specified.<br>*env* `PLAYWRIGHT_MCP_CDP_HEADER` |
| --cdp-timeout <timeout> | timeout in milliseconds for connecting to CDP endpoint, defaults to 30000ms<br>*env* `PLAYWRIGHT_MCP_CDP_TIMEOUT` |
| --codegen <lang> | specify the language to use for code generation, possible values: "typescript", "none". Default is "typescript".<br>*env* `PLAYWRIGHT_MCP_CODEGEN` |
| --config <path> | path to the configuration file.<br>*env* `PLAYWRIGHT_MCP_CONFIG` |
| --console-level <level> | level of console messages to return: "error", "warning", "info", "debug". Each level includes the messages of more severe levels.<br>*env* `PLAYWRIGHT_MCP_CONSOLE_LEVEL` |
| --device <device> | device to emulate, for example: "iPhone 15"<br>*env* `PLAYWRIGHT_MCP_DEVICE` |
| --executable-path <path> | path to the browser executable.<br>*env* `PLAYWRIGHT_MCP_EXECUTABLE_PATH` |
| --extension | Connect to a running browser instance (Edge/Chrome only). Requires the "Playwright Extension" to be installed.<br>*env* `PLAYWRIGHT_MCP_EXTENSION` |
| --endpoint <endpoint> | Bound browser endpoint to connect to.<br>*env* `PLAYWRIGHT_MCP_ENDPOINT` |
| --grant-permissions <permissions...> | List of permissions to grant to the browser context, for example "geolocation", "clipboard-read", "clipboard-write".<br>*env* `PLAYWRIGHT_MCP_GRANT_PERMISSIONS` |
| --headless | run browser in headless mode, headed by default<br>*env* `PLAYWRIGHT_MCP_HEADLESS` |
| --host <host> | host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.<br>*env* `PLAYWRIGHT_MCP_HOST` |
| --ignore-https-errors | ignore https errors<br>*env* `PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS` |
| --init-page <path...> | path to TypeScript file to evaluate on Playwright page object<br>*env* `PLAYWRIGHT_MCP_INIT_PAGE` |
| --init-script <path...> | path to JavaScript file to add as an initialization script. The script will be evaluated in every page before any of the page's scripts. Can be specified multiple times.<br>*env* `PLAYWRIGHT_MCP_INIT_SCRIPT` |
| --isolated | keep the browser profile in memory, do not save it to disk.<br>*env* `PLAYWRIGHT_MCP_ISOLATED` |
| --image-responses <mode> | whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".<br>*env* `PLAYWRIGHT_MCP_IMAGE_RESPONSES` |
| --no-sandbox | disable the sandbox for all process types that are normally sandboxed.<br>*env* `PLAYWRIGHT_MCP_NO_SANDBOX` |
| --output-dir <path> | path to the directory for output files.<br>*env* `PLAYWRIGHT_MCP_OUTPUT_DIR` |
| --output-mode <mode> | whether to save snapshots, console messages, network logs to a file or to the standard output. Can be "file" or "stdout". Default is "stdout".<br>*env* `PLAYWRIGHT_MCP_OUTPUT_MODE` |
| --port <port> | port to listen on for SSE transport.<br>*env* `PLAYWRIGHT_MCP_PORT` |
| --proxy-bypass <bypass> | comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"<br>*env* `PLAYWRIGHT_MCP_PROXY_BYPASS` |
| --proxy-server <proxy> | specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"<br>*env* `PLAYWRIGHT_MCP_PROXY_SERVER` |
| --sandbox | enable the sandbox for all process types that are normally not sandboxed.<br>*env* `PLAYWRIGHT_MCP_SANDBOX` |
| --save-session | Whether to save the Playwright MCP session into the output directory.<br>*env* `PLAYWRIGHT_MCP_SAVE_SESSION` |
| --secrets <path> | path to a file containing secrets in the dotenv format<br>*env* `PLAYWRIGHT_MCP_SECRETS_FILE` |
| --shared-browser-context | reuse the same browser context between all connected HTTP clients.<br>*env* `PLAYWRIGHT_MCP_SHARED_BROWSER_CONTEXT` |
| --snapshot-mode <mode> | when taking snapshots for responses, specifies the mode to use. Can be "full" or "none". Default is "full".<br>*env* `PLAYWRIGHT_MCP_SNAPSHOT_MODE` |
| --storage-state <path> | path to the storage state file for isolated sessions.<br>*env* `PLAYWRIGHT_MCP_STORAGE_STATE` |
| --test-id-attribute <attribute> | specify the attribute to use for test ids, defaults to "data-testid"<br>*env* `PLAYWRIGHT_MCP_TEST_ID_ATTRIBUTE` |
| --timeout-action <timeout> | specify action timeout in milliseconds, defaults to 5000ms<br>*env* `PLAYWRIGHT_MCP_TIMEOUT_ACTION` |
| --timeout-navigation <timeout> | specify navigation timeout in milliseconds, defaults to 60000ms<br>*env* `PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION` |
| --user-agent <ua string> | specify user agent string<br>*env* `PLAYWRIGHT_MCP_USER_AGENT` |
| --user-data-dir <path> | path to the user data directory. If not specified, a temporary directory will be created.<br>*env* `PLAYWRIGHT_MCP_USER_DATA_DIR` |
| --viewport-size <size> | specify browser viewport size in pixels, for example "1280x720"<br>*env* `PLAYWRIGHT_MCP_VIEWPORT_SIZE` |

<!--- End of options generated section -->

## Token Efficiency for Agentic Workflows

Playwright MCP uses accessibility snapshots instead of screenshots, which is significantly more token-efficient. However, for high-throughput agentic workflows with large codebases or complex reasoning, further optimization is possible:

### Reduce Accessibility Tree Depth

The `--snapshot-depth` option limits how many levels of DOM nodes are included in snapshots:

```bash
# Default: unlimited depth (includes all nodes)
npx @playwright/mcp@latest

# Optimized for high-throughput workflows: depth 3-4
npx @playwright/mcp@latest --snapshot-depth 3

# Very aggressive: depth 2 (only top-level interactive elements)
npx @playwright/mcp@latest --snapshot-depth 2
```

**Token reduction:** Typical pages see **30-50% reduction** in snapshot tokens with `--snapshot-depth 3-4`, while maintaining all actionable interactive elements (buttons, inputs, links).

### Filter Non-Interactive Node Types

The `--snapshot-filter` option removes verbose but rarely-useful node types:

```bash
# Exclude generic divs and unmapped roles
npx @playwright/mcp@latest --snapshot-filter "generic,none"

# Aggressive filtering: also exclude paragraphs and text nodes
npx @playwright/mcp@latest --snapshot-filter "generic,none,paragraph,text"
```

Common node types to exclude:

- `generic` - unmapped generic `<div>` and `<span>` elements
- `none` - nodes with role="none" (decorative elements)
- `paragraph` - `<p>` and similar elements (often redundant with text content)
- `text` - bare text nodes outside of interactive elements

**Token reduction:** Filtering reduces snapshot verbosity by **20-40%** depending on page structure.

### Optimal Configuration for High-Throughput Workflows

Combine both strategies for maximum efficiency:

```bash
npx @playwright/mcp@latest --snapshot-depth 3 --snapshot-filter "generic,none"
```

**Expected token reduction:** **45-60%** compared to default (unlimited depth, all nodes).

**Trade-offs:**

- Shallow depth may miss non-interactive content or deeply nested interactive elements
- Filtering removes context that might be useful for complex interactions
- Test with your specific use case to find the right balance

### Smart Snapshot Pruning

The `--snapshot-mode` option enables intelligent pruning to remove decorative and non-actionable nodes:

```bash
# Full tree (default) - all nodes included
npx @playwright/mcp@latest --snapshot-mode full

# Pruned mode - remove decorative nodes with no name and no children
npx @playwright/mcp@latest --snapshot-mode pruned

# Focused mode - only interactive elements and text content (most aggressive)
npx @playwright/mcp@latest --snapshot-mode focused

# No snapshots at all
npx @playwright/mcp@latest --snapshot-mode none
```

**Pruning modes:**

- **full** (default): Returns the complete accessibility tree, no pruning applied
- **pruned**: Removes nodes with no accessible name AND no children. These are typically decorative elements like spacers, empty divs, and visual separators. **Token reduction: 15-35%**
- **focused**: Only includes interactive elements (buttons, links, inputs) and text content (headings, paragraphs). Aggressive mode for maximum efficiency. **Token reduction: 50-70%**
- **none**: No snapshots at all, only returns page metadata

**Smart pruning features:**

- Interactive elements are always preserved (buttons, links, form controls)
- Text content and headings are preserved
- Decorative nodes (no accessible name, no children) are removed in pruned mode
- Maintains full actionability for all interactive elements
- Works in combination with `--snapshot-depth` and `--snapshot-filter`

**Combining strategies for maximum efficiency:**

```bash
# Depth limiting + Pruning + Filtering = maximum reduction
npx @playwright/mcp@latest --snapshot-mode pruned --snapshot-depth 3 --snapshot-filter "generic,none"

# Or in config file:
# {
#   "snapshot": {
#     "mode": "pruned",
#     "depth": 3,
#     "filter": "generic,none"
#   }
# }
```

**Expected combined reduction:**

- **pruned + depth 3**: 40-55% reduction
- **focused mode alone**: 50-70% reduction
- **focused + depth 2 + filter**: 60-80% reduction

**Real-world example:**

A typical e-commerce product page with navigation, product grid, filters, and footer might contain:

- **Full mode**: ~150 nodes, ~600 tokens
- **Pruned mode**: ~100 nodes, ~400 tokens (-33% nodes, -33% tokens)
- **Focused mode**: ~40 nodes, ~160 tokens (-73% nodes, -73% tokens)

**When to use each mode:**

- **full**: General purpose, maximum context
- **pruned**: Most common for balanced speed/context trade-off
- **focused**: High-throughput workflows with token constraints
- **none**: When snapshots aren't needed (testing modes, specific workflows)

### Configuration via File

```json
{
  "snapshot": {
    "mode": "pruned",
    "depth": 3,
    "filter": "generic,none"
  }
}
```

Then run:

```bash
npx @playwright/mcp@latest --config path/to/config.json
```

### User profile

You can run Playwright MCP with persistent profile like a regular browser (default), in isolated contexts for testing sessions, or connect to your existing browser using the browser extension.

**Persistent profile**

All the logged in information will be stored in the persistent profile, you can delete it between sessions if you'd like to clear the offline state.
Persistent profile is located at the following locations and you can override it with the `--user-data-dir` argument.

```bash
# Windows
%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-{workspace-hash}

# macOS
- ~/Library/Caches/ms-playwright/mcp-{channel}-{workspace-hash}

# Linux
- ~/.cache/ms-playwright/mcp-{channel}-{workspace-hash}
```

`{workspace-hash}` is derived from the MCP client's workspace root, so different projects get separate profiles automatically.

> [!IMPORTANT]
> A persistent profile can only be used by one browser instance at a time, so concurrent MCP clients sharing the same workspace will conflict. To run several clients in parallel, start each additional client with `--isolated` or point it at a distinct `--user-data-dir`.

**Isolated**

In the isolated mode, each session is started in the isolated profile. Every time you ask MCP to close the browser,
the session is closed and all the storage state for this session is lost. You can provide initial storage state
to the browser via the config's `contextOptions` or via the `--storage-state` argument. Learn more about the storage
state [here](https://playwright.dev/docs/auth).

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--isolated",
        "--storage-state={path/to/storage.json}"
      ]
    }
  }
}
```

**Browser Extension**

The Playwright MCP Chrome Extension allows you to connect to existing browser tabs and leverage your logged-in sessions and browser state. See [microsoft/playwright › packages/extension](https://github.com/microsoft/playwright/tree/main/packages/extension#readme) for installation and setup instructions.

### Initial state

There are multiple ways to provide the initial state to the browser context or a page.

For the storage state, you can either:

- Start with a user data directory using the `--user-data-dir` argument. This will persist all browser data between the sessions.
- Start with a storage state file using the `--storage-state` argument. This will load cookies and local storage from the file into an isolated browser context.

For the page state, you can use:

- `--init-page` to point to a TypeScript file that will be evaluated on the Playwright page object. This allows you to run arbitrary code to set up the page.

```ts
// init-page.ts
export default async ({ page }) => {
  await page.context().grantPermissions(["geolocation"]);
  await page
    .context()
    .setGeolocation({ latitude: 37.7749, longitude: -122.4194 });
  await page.setViewportSize({ width: 1280, height: 720 });
};
```

- `--init-script` to point to a JavaScript file that will be added as an initialization script. The script will be evaluated in every page before any of the page's scripts.
  This is useful for overriding browser APIs or setting up the environment.

```js
// init-script.js
window.isPlaywrightMCP = true;
```

### Configuration file

The Playwright MCP server can be configured using a JSON configuration file. You can specify the configuration file
using the `--config` command line option:

```bash
npx @playwright/mcp@latest --config path/to/config.json
```

<details>
<summary>Configuration file schema</summary>

<!--- Config generated by update-readme.js -->

```typescript
{
  /**
   * The browser to use.
   */
  browser?: {
    /**
     * The type of browser to use.
     */
    browserName?: "chromium" | "firefox" | "webkit";

    /**
     * Keep the browser profile in memory, do not save it to disk.
     */
    isolated?: boolean;

    /**
     * Path to a user data directory for browser profile persistence.
     * Temporary directory is created by default.
     */
    userDataDir?: string;

    /**
     * Launch options passed to
     * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
     *
     * This is useful for settings options like `channel`, `headless`, `executablePath`, etc.
     */
    launchOptions?: playwright.LaunchOptions;

    /**
     * Context options for the browser context.
     *
     * This is useful for settings options like `viewport`.
     */
    contextOptions?: playwright.BrowserContextOptions;

    /**
     * Chrome DevTools Protocol endpoint to connect to an existing browser instance in case of Chromium family browsers.
     */
    cdpEndpoint?: string;

    /**
     * CDP headers to send with the connect request.
     */
    cdpHeaders?: Record<string, string>;

    /**
     * Timeout in milliseconds for connecting to CDP endpoint. Defaults to 30000 (30 seconds). Pass 0 to disable timeout.
     */
    cdpTimeout?: number;

    /**
     * Remote endpoint to connect to an existing Playwright server.
     */
    remoteEndpoint?: string;

    /**
     * Paths to TypeScript files to add as initialization scripts for Playwright page.
     */
    initPage?: string[];

    /**
     * Paths to JavaScript files to add as initialization scripts.
     * The scripts will be evaluated in every page before any of the page's scripts.
     */
    initScript?: string[];
  };

  /**
   * Connect to a running browser instance (Edge/Chrome only). If specified, `browser`
   * config is ignored.
   * Requires the "Playwright Extension" to be installed.
   */
  extension?: boolean;

  server?: {
    /**
     * The port to listen on for SSE or MCP transport.
     */
    port?: number;

    /**
     * The host to bind the server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.
     */
    host?: string;

    /**
     * The hosts this server is allowed to serve from. Defaults to the host server is bound to.
     * This is not for CORS, but rather for the DNS rebinding protection.
     */
    allowedHosts?: string[];

    /**
     * Logging level: debug, info, warn, or error. Default is "info".
     * Controls verbosity of structured logs.
     */
    logLevel?: "debug" | "info" | "warn" | "error";

    /**
     * Log output format: "json" for JSON lines, "text" for human-readable. Default is "text".
     * Can also be set via LOG_FORMAT environment variable.
     */
    logFormat?: "json" | "text";
  };

  /**
   * List of enabled tool capabilities. Possible values:
   *   - 'core': Core browser automation features.
   *   - 'pdf': PDF generation and manipulation.
   *   - 'vision': Coordinate-based interactions.
   *   - 'devtools': Developer tools features.
   */
  capabilities?: ToolCapability[];

  /**
   * Whether to save the Playwright session into the output directory.
   */
  saveSession?: boolean;

  /**
   * Reuse the same browser context between all connected HTTP clients.
   */
  sharedBrowserContext?: boolean;

  /**
   * Secrets are used to replace matching plain text in the tool responses to prevent the LLM
   * from accidentally getting sensitive data. It is a convenience and not a security feature,
   * make sure to always examine information coming in and from the tool on the client.
   */
  secrets?: Record<string, string>;

  /**
   * The directory to save output files.
   */
  outputDir?: string;

  console?: {
    /**
     * The level of console messages to return. Each level includes the messages of more severe levels. Defaults to "info".
     */
    level?: "error" | "warning" | "info" | "debug";
  };

  network?: {
    /**
     * List of origins to allow the browser to request. Default is to allow all. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
     *
     * Supported formats:
     * - Full origin: `https://example.com:8080` - matches only that origin
     * - Wildcard port: `http://localhost:*` - matches any port on localhost with http protocol
     */
    allowedOrigins?: string[];

    /**
     * List of origins to block the browser to request. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
     *
     * Supported formats:
     * - Full origin: `https://example.com:8080` - matches only that origin
     * - Wildcard port: `http://localhost:*` - matches any port on localhost with http protocol
     */
    blockedOrigins?: string[];
  };

  /**
   * Specify the attribute to use for test ids, defaults to "data-testid".
   */
  testIdAttribute?: string;

  timeouts?: {
    /*
     * Configures default action timeout: https://playwright.dev/docs/api/class-page#page-set-default-timeout. Defaults to 5000ms.
     */
    action?: number;

    /*
     * Configures default navigation timeout: https://playwright.dev/docs/api/class-page#page-set-default-navigation-timeout. Defaults to 60000ms.
     */
    navigation?: number;

    /**
     * Configures default expect timeout: https://playwright.dev/docs/test-timeouts#expect-timeout. Defaults to 5000ms.
     */
    expect?: number;
  };

  /**
   * Whether to send image responses to the client. Can be "allow", "omit", or "auto". Defaults to "auto", which sends images if the client can display them.
   */
  imageResponses?: "allow" | "omit";

  snapshot?: {
    /**
     * When taking snapshots for responses, specifies the mode to use:
     * - "full": Return the complete accessibility tree (default)
     * - "none": Don't return snapshots
     * - "pruned": Remove decorative nodes (no accessible name, no children)
     * - "focused": Only return interactive elements and text content
     */
    mode?: "full" | "none" | "pruned" | "focused";

    /**
     * Limit the depth of the accessibility tree in snapshots to reduce token consumption.
     * Default is unlimited. Set to a number like 3-5 for high-throughput agentic workflows.
     * Shallow trees (depth 2-3) significantly reduce tokens while maintaining actionable elements.
     */
    depth?: number;

    /**
     * Exclude node types from snapshots to reduce verbosity. Useful for filtering out rarely-useful nodes.
     * Comma-separated list of node types to exclude (e.g. "generic,none,paragraph,text").
     * Default includes all nodes. Common nodes to exclude: "generic" (generic divs), "none" (unmapped roles).
     */
    filter?: string;

    /**
     * Whether to prune invisible/decorative nodes automatically.
     * When enabled, nodes with no accessible name and no children are removed.
     * Ignored if mode is "none" or "focused".
     * @deprecated Use mode: "pruned" or mode: "focused" instead.
     */
    prune?: boolean;
  };

  /**
   * allowUnrestrictedFileAccess acts as a guardrail to prevent the LLM from accidentally
   * wandering outside its intended workspace. It is a convenience defense to catch unintended
   * file access, not a secure boundary; a deliberate attempt to reach other directories can be
   * easily worked around, so always rely on client-level permissions for true security.
   */
  allowUnrestrictedFileAccess?: boolean;

  /**
   * Specify the language to use for code generation.
   */
  codegen?: "typescript" | "none";
}
```

<!--- End of config generated section -->

</details>

### Standalone MCP server

When running headed browser on system w/o display or from worker processes of the IDEs,
run the MCP server from environment with the DISPLAY and pass the `--port` flag to enable HTTP transport.

```bash
npx @playwright/mcp@latest --port 8931
```

And then in MCP client config, set the `url` to the HTTP endpoint:

```js
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

## Security

Playwright MCP is **not** a security boundary. See [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) for guidance on securing your deployment.

### HTTP Authentication

When exposing Playwright MCP over HTTP (via `--port`), use the `--auth-token` option to require Bearer token authentication:

```bash
# Server
npx @playwright/mcp@latest --port 8931 --auth-token my-secure-token-12345

# Client
curl -H "Authorization: Bearer my-secure-token-12345" http://localhost:8931/messages
```

**Important:** Without `--auth-token`, any client with access to the HTTP endpoint can control the browser. The token can be set via the `PLAYWRIGHT_MCP_AUTH_TOKEN` environment variable.

<details>
<summary><b>Docker</b></summary>

The Docker image includes all three Playwright browsers (Chromium, Firefox, WebKit) and runs in headless mode.

**Basic usage:**

```js
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp"]
    }
  }
}
```

**Using different browsers:**

```js
{
  "mcpServers": {
    "playwright-firefox": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp", "--browser", "firefox"]
    },
    "playwright-webkit": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp", "--browser", "webkit"]
    }
  }
}
```

**Running as a long-lived service:**

```bash
docker run -d -i --rm --init --pull=always \
  --entrypoint node \
  --name playwright \
  -p 8931:8931 \
  mcr.microsoft.com/playwright/mcp \
  /app/cli.js --headless --browser chromium --no-sandbox --port 8931 --host 0.0.0.0
```

You can replace `--browser chromium` with `--browser firefox` or `--browser webkit` to use a different browser.

The server will listen on host port **8931** and can be reached by any MCP client.

**Building the image:**

```bash
docker build -t mcr.microsoft.com/playwright/mcp .
```

**Validating browser support in container:**

```bash
# Chromium (default)
docker run --rm --pull=always mcr.microsoft.com/playwright/mcp --version

# Firefox
docker run --rm --pull=always mcr.microsoft.com/playwright/mcp --browser firefox --version

# WebKit
docker run --rm --pull=always mcr.microsoft.com/playwright/mcp --browser webkit --version
```

**Browser support:**

- **Chromium**: Fully supported in Docker
- **Firefox**: Fully supported in Docker
- **WebKit**: Fully supported in Docker

**Known limitations:**

- Browser sandboxing is disabled by default in the container (`--no-sandbox`) for compatibility.
- Running headed mode in container requires additional display setup (for example, Xvfb); headless mode is the supported default.

</details>

<details>
<summary><b>Programmatic usage with authentication</b></summary>

```js
import http from "http";

import { createConnection } from "@playwright/mcp";
import { createAuthenticatedHandler } from "@playwright/mcp/src/server";

http
  .createServer(async (req, res) => {
    // Creates a headless Playwright MCP server with Bearer token authentication
    const connection = await createConnection({
      browser: { launchOptions: { headless: true } },
    });
    const handler = createAuthenticatedHandler(connection, {
      authToken: process.env.PLAYWRIGHT_MCP_AUTH_TOKEN || "my-secret-token",
    });

    handler(req, res);
  })
  .listen(8931);
```

Clients connecting to the server must include the Bearer token:

```js
const response = await fetch("http://localhost:8931/messages", {
  method: "POST",
  headers: {
    Authorization: "Bearer my-secret-token",
  },
  // ...
});
```

</details>

<details>
<summary><b>Programmatic usage</b></summary>

```js
import http from "http";

import { createConnection } from "@playwright/mcp";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

http.createServer(async (req, res) => {
  // ...

  // Creates a headless Playwright MCP server with SSE transport
  const connection = await createConnection({
    browser: { launchOptions: { headless: true } },
  });
  const transport = new SSEServerTransport("/messages", res);
  await connection.connect(transport);

  // ...
});
```

</details>

### Structured Logging and Observability

Playwright MCP supports structured logging to help with debugging and production monitoring. Logs include timestamps, log levels, session IDs, and contextual information like tool names and operation durations.

#### Enabling Structured Logging

By default, logs are unstructured and human-readable. To enable structured JSON logging:

```bash
# Enable JSON line format
LOG_FORMAT=json npx @playwright/mcp@latest

# Or set via CLI (when supported in monorepo implementation)
npx @playwright/mcp@latest --log-format json
```

#### Log Levels

Control logging verbosity with the `LOG_LEVEL` environment variable or `--log-level` option:

```bash
# Show only warnings and errors (default: info)
LOG_LEVEL=warn npx @playwright/mcp@latest

# Show all messages including debug
LOG_LEVEL=debug npx @playwright/mcp@latest

# Levels: debug, info, warn, error
```

#### Log Entry Structure

Each structured log entry includes:

- **timestamp** (ISO 8601): When the event occurred
- **level** (debug|info|warn|error): Log severity
- **message**: Human-readable description
- **sessionId**: Unique session identifier for correlation
- **context** (optional): Additional fields depending on event type

#### Log Formats

**Text format (default):**

```
[INFO] 2024-05-12T10:30:45.123Z | Browser navigated | url=https://example.com durationMs=245
```

**JSON format (LOG_FORMAT=json):**

```json
{
  "timestamp": "2024-05-12T10:30:45.123Z",
  "level": "info",
  "message": "Browser navigated",
  "sessionId": "abc-123",
  "context": { "url": "https://example.com", "durationMs": 245 }
}
```

#### Common Log Events

**Tool invocation:**

```json
{
  "timestamp": "2024-05-12T10:30:45.123Z",
  "level": "info",
  "message": "Tool invoked: browser_click",
  "sessionId": "abc-123",
  "context": { "tool": "browser_click", "durationMs": 125, "status": "success" }
}
```

**Tool error:**

```json
{
  "level": "error",
  "message": "Tool invoked: browser_navigate",
  "context": {
    "tool": "browser_navigate",
    "durationMs": 5000,
    "status": "error",
    "error": "Timeout waiting for navigation"
  }
}
```

**Browser lifecycle:**

```json
{"level":"info","message":"Browser launch","context":{"event":"launch","browserType":"chromium"}}
{"level":"info","message":"Browser navigate","context":{"event":"navigate","url":"https://example.com"}}
{"level":"info","message":"Browser close","context":{"event":"close","reason":"session_end"}}
```

#### Production Monitoring

For production deployments, collect structured logs to your observability platform:

```bash
# Pipe logs to a log aggregation service
LOG_FORMAT=json npx @playwright/mcp@latest | jq . | tee >(curl -X POST https://logs.example.com/ingest)

# Or use with Docker
docker run -e LOG_FORMAT=json mcr.microsoft.com/playwright/mcp | jq .
```

#### Using the Logger in Code

```js
import { getLogger, PerformanceTimer } from "@playwright/mcp";

const logger = getLogger();

// Log a message with context
logger.info("User action", { userId: "123", action: "click" });

// Log tool invocation
const timer = new PerformanceTimer("browser_click");
try {
  await page.click("button");
  logger.toolInvocation("browser_click", timer.elapsed(), true);
} catch (error) {
  logger.toolInvocation("browser_click", timer.elapsed(), false, error.message);
}

// Log browser events
logger.browserEvent("launch", { browserType: "chromium" });
logger.browserEvent("navigate", { url: "https://example.com" });
```

### Health Dashboard & Observability

When the Playwright MCP server is started with `--port`, a real-time health dashboard is automatically available at `http://localhost:<port>/`.

#### Dashboard Features

The health dashboard displays:

- **Server Status**: Status, version, uptime, and authentication status
- **Metrics**: Request count today, average response time
- **Browsers**: Status of each browser (Chromium, Firefox, WebKit)
- **Capabilities**: Available features (vision, PDF, etc.) with on/off status
- **Configuration**: Current snapshot mode, depth, log level, and other settings
- **Live Log**: Last 50 log entries with auto-refresh every 5 seconds

#### Accessing the Dashboard

Once the server is running on a port, open your browser to view the dashboard:

```bash
# Start server with HTTP transport
npx @playwright/mcp@latest --port 8080

# Open dashboard in browser
# Visit: http://localhost:8080/
```

#### Health API Endpoint

The dashboard pulls data from the `GET /api/health` JSON endpoint:

```bash
curl http://localhost:8080/api/health
```

Response structure:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "auth_enabled": true,
  "capabilities": {
    "vision": true,
    "pdf": false,
    "core": true
  },
  "browsers": {
    "chromium": "ready",
    "firefox": "ready",
    "webkit": "unavailable"
  },
  "config": {
    "snapshot_mode": "pruned",
    "snapshot_depth": 3,
    "log_level": "info"
  },
  "metrics": {
    "requests_today": 42,
    "avg_response_ms": 125,
    "total_response_ms": 5250,
    "response_count": 42
  },
  "log_tail": [
    "2024-05-12T10:30:45.123Z Tool invoked: browser_click",
    "2024-05-12T10:30:46.456Z Browser navigate"
  ]
}
```

#### Disabling the Dashboard

To disable the health dashboard (for security or performance), use:

```ts
import { createAuthenticatedHandler } from "@playwright/mcp";

const handler = createAuthenticatedHandler(connection, {
  enableDashboard: false,
});
```

The `/api/health` endpoint always remains available for programmatic access.

#### Dashboard Design

- **Dark mode support**: Automatically adapts to system preferences via `prefers-color-scheme`
- **Mobile-friendly**: Single-column layout below 600px width
- **No dependencies**: Vanilla HTML/CSS/JavaScript, no frameworks or external CDN
- **Self-contained**: All assets embedded in the page, no separate file loads

#### Dashboard Examples

| Section        | Example Value |
| -------------- | ------------- |
| Status         | OK / Error    |
| Version        | 1.0.0         |
| Uptime         | 1h 30m        |
| Requests Today | 1,234         |
| Avg Response   | 45 ms         |
| Chromium       | ready ✓       |
| Firefox        | unavailable ✗ |
| Vision         | enabled ✓     |
| PDF            | disabled ✗    |

### Tools

<!--- Tools generated by update-readme.js -->

<details>
<summary><b>Core automation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_click**
  - Title: Click
  - Description: Perform click on a web page
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
    - `doubleClick` (boolean, optional): Whether to perform a double click instead of a single click
    - `button` (string, optional): Button to click, defaults to left
    - `modifiers` (array, optional): Modifier keys to press
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Title: Close browser
  - Description: Close the page
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_console_messages**
  - Title: Get console messages
  - Description: Returns all console messages
  - Parameters:
    - `level` (string): Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info".
    - `all` (boolean, optional): Return all console messages since the beginning of the session, not just since the last navigation. Defaults to false.
    - `filename` (string, optional): Filename to save the console messages to. If not provided, messages are returned as text.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Title: Drag mouse
  - Description: Perform drag and drop between two elements
  - Parameters:
    - `startElement` (string, optional): Human-readable source element description used to obtain the permission to interact with the element
    - `startTarget` (string): Exact target element reference from the page snapshot, or a unique element selector
    - `endElement` (string, optional): Human-readable target element description used to obtain the permission to interact with the element
    - `endTarget` (string): Exact target element reference from the page snapshot, or a unique element selector
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drop**
  - Title: Drop files or data onto an element
  - Description: Drop files or MIME-typed data onto an element, as if dragged from outside the page. At least one of "paths" or "data" must be provided.
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
    - `paths` (array, optional): Absolute paths to files to drop onto the element.
    - `data` (object, optional): Data to drop, as a map of MIME type to string value (e.g. {"text/plain": "hello", "text/uri-list": "https://example.com"}).
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string, optional): Exact target element reference from the page snapshot, or a unique element selector
    - `function` (string): () => { /* code */ } or (element) => { /* code */ } when element is provided
    - `filename` (string, optional): Filename to save the result to. If not provided, result is returned as text.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files
  - Parameters:
    - `paths` (array, optional): The absolute paths to the files to upload. Can be single file or multiple files. If omitted, file chooser is cancelled.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_fill_form**
  - Title: Fill form
  - Description: Fill multiple form fields
  - Parameters:
    - `fields` (array): Fields to fill in
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Title: Handle a dialog
  - Description: Handle a dialog
  - Parameters:
    - `accept` (boolean): Whether to accept the dialog.
    - `promptText` (string, optional): The text of the prompt in case of a prompt dialog.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Title: Hover mouse
  - Description: Hover over element on page
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Title: Go back
  - Description: Go back to the previous page in the history
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_request**
  - Title: Show network request details
  - Description: Returns full details (headers and body) of a single network request, or a single part if `part` is set. Use the number from browser_network_requests.
  - Parameters:
    - `index` (integer): 1-based index of the request, as printed by browser_network_requests.
    - `part` (string, optional): Return only this part of the request. Omit to return full details.
    - `filename` (string, optional): Filename to save the result to. If not provided, output is returned as text.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_requests**
  - Title: List network requests
  - Description: Returns a numbered list of network requests since loading the page. Use browser_network_request with the number to get full details.
  - Parameters:
    - `static` (boolean): Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.
    - `filter` (string, optional): Only return requests whose URL matches this regexp (e.g. "/api/.*user").
    - `filename` (string, optional): Filename to save the network requests to. If not provided, requests are returned as text.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Title: Resize browser window
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_run_code_unsafe**
  - Title: Run Playwright code (unsafe)
  - Description: Run a Playwright code snippet. Unsafe: executes arbitrary JavaScript in the Playwright server process and is RCE-equivalent.
  - Parameters:
    - `code` (string, optional): A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction. For example: `async (page) => { await page.getByRole('button', { name: 'Submit' }).click(); return await page.title(); }`
    - `filename` (string, optional): Load code from the specified file. If both code and filename are provided, code will be ignored.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Title: Select option
  - Description: Select an option in a dropdown
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters:
    - `target` (string, optional): Exact target element reference from the page snapshot, or a unique element selector
    - `filename` (string, optional): Save snapshot to markdown file instead of returning it in the response.
    - `depth` (number, optional): Limit the depth of the snapshot tree
    - `boxes` (boolean, optional): Include each element's bounding box as [box=x,y,width,height] in the snapshot. Coordinates are viewport-relative, in CSS pixels (Element.getBoundingClientRect)
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Title: Take a screenshot
  - Description: Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string, optional): Exact target element reference from the page snapshot, or a unique element selector
    - `type` (string): Image format for the screenshot. Default is png.
    - `filename` (string, optional): File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified. Prefer relative file names to stay within the output directory.
    - `fullPage` (boolean, optional): When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Title: Type text
  - Description: Type text into editable element
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear or disappear or a specified time to pass
  - Parameters:
    - `time` (number, optional): The time to wait in seconds
    - `text` (string, optional): The text to wait for
    - `textGone` (string, optional): The text to wait for to disappear
  - Read-only: **false**

</details>

<details>
<summary><b>Tab management</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tabs**
  - Title: Manage tabs
  - Description: List, create, close, or select a browser tab.
  - Parameters:
    - `action` (string): Operation to perform
    - `index` (number, optional): Tab index, used for close/select. If omitted for close, current tab is closed.
    - `url` (string, optional): URL to navigate to in the new tab, used for new.
  - Read-only: **false**

</details>

<details>
<summary><b>Browser installation</b></summary>

</details>

<details>
<summary><b>Configuration (opt-in via --caps=config)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_get_config**
  - Title: Get config
  - Description: Get the final resolved config after merging CLI options, environment variables and config file.
  - Parameters: None
  - Read-only: **true**

</details>

<details>
<summary><b>Network (opt-in via --caps=network)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_state_set**
  - Title: Set network state
  - Description: Sets the browser network state to online or offline. When offline, all network requests will fail.
  - Parameters:
    - `state` (string): Set to "offline" to simulate offline mode, "online" to restore network connectivity
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_route**
  - Title: Mock network requests
  - Description: Set up a route to mock network requests matching a URL pattern
  - Parameters:
    - `pattern` (string): URL pattern to match (e.g., "**/api/users", "**/*.{png,jpg}")
    - `status` (number, optional): HTTP status code to return (default: 200)
    - `body` (string, optional): Response body (text or JSON string)
    - `contentType` (string, optional): Content-Type header (e.g., "application/json", "text/html")
    - `headers` (array, optional): Headers to add in "Name: Value" format
    - `removeHeaders` (string, optional): Comma-separated list of header names to remove from request
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_route_list**
  - Title: List network routes
  - Description: List all active network routes
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_unroute**
  - Title: Remove network routes
  - Description: Remove network routes matching a pattern (or all routes if no pattern specified)
  - Parameters:
    - `pattern` (string, optional): URL pattern to unroute (omit to remove all routes)
  - Read-only: **false**

</details>

<details>
<summary><b>Storage (opt-in via --caps=storage)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_cookie_clear**
  - Title: Clear cookies
  - Description: Clear all cookies
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_cookie_delete**
  - Title: Delete cookie
  - Description: Delete a specific cookie
  - Parameters:
    - `name` (string): Cookie name to delete
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_cookie_get**
  - Title: Get cookie
  - Description: Get a specific cookie by name
  - Parameters:
    - `name` (string): Cookie name to get
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_cookie_list**
  - Title: List cookies
  - Description: List all cookies (optionally filtered by domain/path)
  - Parameters:
    - `domain` (string, optional): Filter cookies by domain
    - `path` (string, optional): Filter cookies by path
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_cookie_set**
  - Title: Set cookie
  - Description: Set a cookie with optional flags (domain, path, expires, httpOnly, secure, sameSite)
  - Parameters:
    - `name` (string): Cookie name
    - `value` (string): Cookie value
    - `domain` (string, optional): Cookie domain
    - `path` (string, optional): Cookie path
    - `expires` (number, optional): Cookie expiration as Unix timestamp
    - `httpOnly` (boolean, optional): Whether the cookie is HTTP only
    - `secure` (boolean, optional): Whether the cookie is secure
    - `sameSite` (string, optional): Cookie SameSite attribute
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_localstorage_clear**
  - Title: Clear localStorage
  - Description: Clear all localStorage
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_localstorage_delete**
  - Title: Delete localStorage item
  - Description: Delete a localStorage item
  - Parameters:
    - `key` (string): Key to delete
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_localstorage_get**
  - Title: Get localStorage item
  - Description: Get a localStorage item by key
  - Parameters:
    - `key` (string): Key to get
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_localstorage_list**
  - Title: List localStorage
  - Description: List all localStorage key-value pairs
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_localstorage_set**
  - Title: Set localStorage item
  - Description: Set a localStorage item
  - Parameters:
    - `key` (string): Key to set
    - `value` (string): Value to set
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_sessionstorage_clear**
  - Title: Clear sessionStorage
  - Description: Clear all sessionStorage
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_sessionstorage_delete**
  - Title: Delete sessionStorage item
  - Description: Delete a sessionStorage item
  - Parameters:
    - `key` (string): Key to delete
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_sessionstorage_get**
  - Title: Get sessionStorage item
  - Description: Get a sessionStorage item by key
  - Parameters:
    - `key` (string): Key to get
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_sessionstorage_list**
  - Title: List sessionStorage
  - Description: List all sessionStorage key-value pairs
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_sessionstorage_set**
  - Title: Set sessionStorage item
  - Description: Set a sessionStorage item
  - Parameters:
    - `key` (string): Key to set
    - `value` (string): Value to set
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_set_storage_state**
  - Title: Restore storage state
  - Description: Restore storage state (cookies, local storage) from a file. This clears existing cookies and local storage before restoring.
  - Parameters:
    - `filename` (string): Path to the storage state file to restore from
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_storage_state**
  - Title: Save storage state
  - Description: Save storage state (cookies, local storage) to a file for later reuse
  - Parameters:
    - `filename` (string, optional): File name to save the storage state to. Defaults to `storage-state-{timestamp}.json` if not specified.
  - Read-only: **true**

</details>

<details>
<summary><b>DevTools (opt-in via --caps=devtools)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_annotate**
  - Title: Annotate the current page
  - Description: Open the Playwright Dashboard in annotation mode for the current page and wait for the user to draw annotations. Returns the annotated screenshot, ARIA snapshot, and the list of annotations.
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hide_highlight**
  - Title: Hide element highlight
  - Description: Remove a highlight overlay previously added for the element.
  - Parameters:
    - `element` (string, optional): Human-readable element description used when adding the highlight; must match the value passed to browser_highlight.
    - `target` (string, optional): Exact target element reference from the page snapshot, or a unique element selector
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_highlight**
  - Title: Highlight element
  - Description: Show a persistent highlight overlay around the element on the page.
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
    - `style` (string, optional): Additional inline CSS applied to the highlight overlay, e.g. "outline: 2px dashed red".
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resume**
  - Title: Resume paused script execution
  - Description: Resume script execution after it was paused. When called with step set to true, execution will pause again before the next action.
  - Parameters:
    - `step` (boolean, optional): When true, execution will pause again before the next action, allowing step-by-step debugging.
    - `location` (string, optional): Pause execution at a specific <file>:<line>, e.g. "example.spec.ts:42".
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_start_tracing**
  - Title: Start tracing
  - Description: Start trace recording
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_start_video**
  - Title: Start video
  - Description: Start video recording
  - Parameters:
    - `filename` (string, optional): Filename to save the video.
    - `size` (object, optional): Video size
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_stop_tracing**
  - Title: Stop tracing
  - Description: Stop trace recording
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_stop_video**
  - Title: Stop video
  - Description: Stop video recording
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_video_chapter**
  - Title: Video chapter
  - Description: Add a chapter marker to the video recording. Shows a full-screen chapter card with blurred backdrop.
  - Parameters:
    - `title` (string): Chapter title
    - `description` (string, optional): Chapter description
    - `duration` (number, optional): Duration in milliseconds to show the chapter card
  - Read-only: **true**

</details>

<details>
<summary><b>Coordinate-based (opt-in via --caps=vision)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_click_xy**
  - Title: Click
  - Description: Click mouse button at a given position
  - Parameters:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `button` (string, optional): Button to click, defaults to left
    - `clickCount` (number, optional): Number of clicks, defaults to 1
    - `delay` (number, optional): Time to wait between mouse down and mouse up in milliseconds, defaults to 0
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_down**
  - Title: Press mouse down
  - Description: Press mouse down
  - Parameters:
    - `button` (string, optional): Button to press, defaults to left
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_drag_xy**
  - Title: Drag mouse
  - Description: Drag left mouse button to a given position
  - Parameters:
    - `startX` (number): Start X coordinate
    - `startY` (number): Start Y coordinate
    - `endX` (number): End X coordinate
    - `endY` (number): End Y coordinate
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_move_xy**
  - Title: Move mouse
  - Description: Move mouse to a given position
  - Parameters:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_up**
  - Title: Press mouse up
  - Description: Press mouse up
  - Parameters:
    - `button` (string, optional): Button to press, defaults to left
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_wheel**
  - Title: Scroll mouse wheel
  - Description: Scroll mouse wheel
  - Parameters:
    - `deltaX` (number): X delta
    - `deltaY` (number): Y delta
  - Read-only: **false**

</details>

<details>
<summary><b>PDF generation (opt-in via --caps=pdf)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Title: Save as PDF
  - Description: Save page as PDF
  - Parameters:
    - `filename` (string, optional): File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified. Prefer relative file names to stay within the output directory.
  - Read-only: **true**

</details>

<details>
<summary><b>Test assertions (opt-in via --caps=testing)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_generate_locator**
  - Title: Create locator for element
  - Description: Generate locator for the given element to use in tests
  - Parameters:
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `target` (string): Exact target element reference from the page snapshot, or a unique element selector
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_verify_element_visible**
  - Title: Verify element visible
  - Description: Verify element is visible on the page
  - Parameters:
    - `role` (string): ROLE of the element. Can be found in the snapshot like this: `- {ROLE} "Accessible Name":`
    - `accessibleName` (string): ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: `- role "{ACCESSIBLE_NAME}"`
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_verify_list_visible**
  - Title: Verify list visible
  - Description: Verify list is visible on the page
  - Parameters:
    - `element` (string): Human-readable list description
    - `target` (string): Exact target element reference that points to the list
    - `items` (array): Items to verify
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_verify_text_visible**
  - Title: Verify text visible
  - Description: Verify text is visible on the page. Prefer browser_verify_element_visible if possible.
  - Parameters:
    - `text` (string): TEXT to verify. Can be found in the snapshot like this: `- role "Accessible Name": {TEXT}` or like this: `- text: {TEXT}`
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_verify_value**
  - Title: Verify value
  - Description: Verify element value
  - Parameters:
    - `type` (string): Type of the element
    - `element` (string): Human-readable element description
    - `target` (string): Exact target element reference from the page snapshot
    - `value` (string): Value to verify. For checkbox, use "true" or "false".
  - Read-only: **false**

</details>


<!--- End of tools generated section -->
