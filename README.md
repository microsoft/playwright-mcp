## Playwright MCP

A Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev). This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

### Key Features

- **Fast and lightweight**. Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**. No vision models needed, operates purely on structured data.
- **Deterministic tool application**. Avoids ambiguity common with screenshot-based approaches.

### Fast Server Features (This Fork)

- **Token Optimization**. All tools support an `expectation` parameter to control response content:
  - `includeCode: false` - Suppress Playwright code generation to reduce tokens
  - `includeSnapshot: false` - Skip page snapshot for minimal responses (70-80% token reduction)
  - `includeConsole: false` - Exclude console messages
  - `includeTabs: false` - Hide tab information
- **Ultra-Compact Tool Descriptions**. One-line tool descriptions with full parameter details:
  - 70-80% reduction in tool description tokens
  - All expectation parameters inline without formatting overhead
  - Smart tips for efficient usage (e.g., "Use selector to focus on specific area")
- **Image Compression**. Screenshot tool supports `imageOptions`:
  - `format: 'jpeg'` - Use JPEG instead of PNG
  - `quality: 1-100` - Compress images (e.g., 50 for 50% quality)
  - `maxWidth: number` - Resize images to max width
- **Batch Execution**. Use `browser_batch_execute` for multiple operations:
  - Significant token reduction by eliminating redundant responses
  - Per-step and global expectation configuration
  - Error handling with `continueOnError` and `stopOnFirstError` options
- **Snapshot Control**. Limit snapshot size with `snapshotOptions`:
  - `selector: string` - Capture only specific page sections (recommended over maxLength)
  - `format: "aria"` - Accessibility tree format for LLM processing
- **Diff Detection**. Track only changes with `diffOptions`:
  - `enabled: true` - Show only what changed from previous state (massive token saver)
  - `format: "minimal"` - Ultra-compact diff output
  - Perfect for monitoring state changes during navigation or interactions
- **Diagnostic System**. Advanced debugging and element discovery tools:
  - `browser_find_elements` - Find elements using multiple search criteria (text, role, attributes)
  - `browser_diagnose` - Comprehensive page analysis with performance metrics and troubleshooting
  - Enhanced error handling with alternative element suggestions
  - Page structure analysis (iframes, modals, accessibility metrics)
  - Performance monitoring with execution time under 300ms

### Requirements
- Node.js 18 or newer
- VS Code, Cursor, Windsurf, Claude Desktop, Goose or any other MCP client

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
        "@tontoko/fast-playwright-mcp@latest"
      ]
    }
  }
}
```

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)


<details>
<summary>Claude Code</summary>

Use the Claude Code CLI to add the Playwright MCP server:

```bash
claude mcp add fast-playwright npx @tontoko/fast-playwright-mcp@latest
```
</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Cursor</summary>

#### Click the button to install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx @tontoko/fast-playwright-mcp`. You can also verify config or add command like arguments via clicking `Edit`.

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

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx @tontoko/fast-playwright-mcp`. Click "Add Extension".
</details>

<details>
<summary>LM Studio</summary>

#### Click the button to install:

[![Add MCP Server playwright to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJAcGxheXdyaWdodC9tY3BAbGF0ZXN0Il19)

#### Or install manually:

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.
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
code --add-mcp '{"name":"fast-playwright","command":"npx","args":["@tontoko/fast-playwright-mcp@latest"]}'
```

After installation, the Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.
</details>

<details>
<summary>Windsurf</summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

### Configuration

Playwright MCP server supports following arguments. They can be provided in the JSON configuration above, as a part of the `"args"` list:

<!--- Options generated by update-readme.js -->

```
> npx @tontoko/fast-playwright-mcp@latest --help
  --allowed-origins <origins>  semicolon-separated list of origins to allow the
                               browser to request. Default is to allow all.
  --blocked-origins <origins>  semicolon-separated list of origins to block the
                               browser from requesting. Blocklist is evaluated
                               before allowlist. If used without the allowlist,
                               requests not matching the blocklist are still
                               allowed.
  --block-service-workers      block service workers
  --browser <browser>          browser or chrome channel to use, possible
                               values: chrome, firefox, webkit, msedge.
  --caps <caps>                comma-separated list of additional capabilities
                               to enable, possible values: vision, pdf.
  --cdp-endpoint <endpoint>    CDP endpoint to connect to.
  --config <path>              path to the configuration file.
  --device <device>            device to emulate, for example: "iPhone 15"
  --executable-path <path>     path to the browser executable.
  --headless                   run browser in headless mode, headed by default
  --host <host>                host to bind server to. Default is localhost. Use
                               0.0.0.0 to bind to all interfaces.
  --ignore-https-errors        ignore https errors
  --isolated                   keep the browser profile in memory, do not save
                               it to disk.
  --image-responses <mode>     whether to send image responses to the client.
                               Can be "allow" or "omit", Defaults to "allow".
  --no-sandbox                 disable the sandbox for all process types that
                               are normally sandboxed.
  --output-dir <path>          path to the directory for output files.
  --port <port>                port to listen on for SSE transport.
  --proxy-bypass <bypass>      comma-separated domains to bypass proxy, for
                               example ".com,chromium.org,.domain.com"
  --proxy-server <proxy>       specify proxy server, for example
                               "http://myproxy:3128" or "socks5://myproxy:8080"
  --save-session               Whether to save the Playwright MCP session into
                               the output directory.
  --save-trace                 Whether to save the Playwright Trace of the
                               session into the output directory.
  --storage-state <path>       path to the storage state file for isolated
                               sessions.
  --user-agent <ua string>     specify user agent string
  --user-data-dir <path>       path to the user data directory. If not
                               specified, a temporary directory will be created.
  --viewport-size <size>       specify browser viewport size in pixels, for
                               example "1280, 720"
```

<!--- End of options generated section -->

### User profile

You can run Playwright MCP with persistent profile like a regular browser (default), or in the isolated contexts for the testing sessions.

**Persistent profile**

All the logged in information will be stored in the persistent profile, you can delete it between sessions if you'd like to clear the offline state.
Persistent profile is located at the following locations and you can override it with the `--user-data-dir` argument.

```bash
# Windows
%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile

# macOS
- ~/Library/Caches/ms-playwright/mcp-{channel}-profile

# Linux
- ~/.cache/ms-playwright/mcp-{channel}-profile
```

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
        "@tontoko/fast-playwright-mcp@latest",
        "--isolated",
        "--storage-state={path/to/storage.json}"
      ]
    }
  }
}
```

### Configuration file

The Playwright MCP server can be configured using a JSON configuration file. You can specify the configuration file
using the `--config` command line option:

```bash
npx @tontoko/fast-playwright-mcp@latest --config path/to/config.json
```

<details>
<summary>Configuration file schema</summary>

```typescript
{
  // Browser configuration
  browser?: {
    // Browser type to use (chromium, firefox, or webkit)
    browserName?: 'chromium' | 'firefox' | 'webkit';

    // Keep the browser profile in memory, do not save it to disk.
    isolated?: boolean;

    // Path to user data directory for browser profile persistence
    userDataDir?: string;

    // Browser launch options (see Playwright docs)
    // @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
    launchOptions?: {
      channel?: string;        // Browser channel (e.g. 'chrome')
      headless?: boolean;      // Run in headless mode
      executablePath?: string; // Path to browser executable
      // ... other Playwright launch options
    };

    // Browser context options
    // @see https://playwright.dev/docs/api/class-browser#browser-new-context
    contextOptions?: {
      viewport?: { width: number, height: number };
      // ... other Playwright context options
    };

    // CDP endpoint for connecting to existing browser
    cdpEndpoint?: string;

    // Remote Playwright server endpoint
    remoteEndpoint?: string;
  },

  // Server configuration
  server?: {
    port?: number;  // Port to listen on
    host?: string;  // Host to bind to (default: localhost)
  },

  // List of additional capabilities
  capabilities?: Array<
    'tabs' |    // Tab management
    'install' | // Browser installation
    'pdf' |     // PDF generation
    'vision' |  // Coordinate-based interactions
  >;

  // Directory for output files
  outputDir?: string;

  // Network configuration
  network?: {
    // List of origins to allow the browser to request. Default is to allow all. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
    allowedOrigins?: string[];

    // List of origins to block the browser to request. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
    blockedOrigins?: string[];
  };
 
  /**
   * Whether to send image responses to the client. Can be "allow" or "omit". 
   * Defaults to "allow".
   */
  imageResponses?: 'allow' | 'omit';
}
```
</details>

### Standalone MCP server

When running headed browser on system w/o display or from worker processes of the IDEs,
run the MCP server from environment with the DISPLAY and pass the `--port` flag to enable HTTP transport.

```bash
npx @tontoko/fast-playwright-mcp@latest --port 8931
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

<details>
<summary><b>Docker</b></summary>

**NOTE:** The Docker implementation only supports headless chromium at the moment.

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

You can build the Docker image yourself.

```
docker build -t mcr.microsoft.com/playwright/mcp .
```
</details>

<details>
<summary><b>Programmatic usage</b></summary>

```js
import http from 'http';

import { createConnection } from '@tontoko/fast-playwright-mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

http.createServer(async (req, res) => {
  // ...

  // Creates a headless Playwright MCP server with SSE transport
  const connection = await createConnection({ browser: { launchOptions: { headless: true } } });
  const transport = new SSEServerTransport('/messages', res);
  await connection.sever.connect(transport);

  // ...
});
```
</details>

### Tools

<!--- Tools generated by update-readme.js -->

<details>
<summary><b>Core automation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_batch_execute**
  - Title: Batch Execute Browser Actions
  - Description: Execute multiple browser actions in sequence with optimized response handling.RECOMMENDED:Use this tool instead of individual actions when performing multiple operations to significantly reduce token usage and improve performance.BY DEFAULT use for:form filling(multiple type→click),multi-step navigation,any workflow with 2+ known steps.Saves 90% tokens vs individual calls.globalExpectation:{includeSnapshot:false,snapshotOptions:{selector:"#app"},diffOptions:{enabled:true}}.Per-step override:steps[].expectation.Example:[{tool:"browser_navigate",arguments:{url:"https://example.com"}},{tool:"browser_type",arguments:{element:"username",ref:"#user",text:"john"}},{tool:"browser_click",arguments:{element:"submit",ref:"#btn"}}].
  - Parameters:
    - `steps` (array): Array of steps to execute in sequence
    - `stopOnFirstError` (boolean, optional): Stop entire batch on first error
    - `globalExpectation` (optional): Default expectation for all steps
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_click**
  - Title: Click
  - Description: Perform click on web page.USE batch_execute for multi-click workflows.expectation:{includeSnapshot:false} when next action follows immediately,true to verify result.diffOptions:{enabled:true,format:"minimal"} shows only changes(saves 80% tokens).snapshotOptions:{selector:".result"} to focus on result area.doubleClick:true for double-click,button:"right" for context menu.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `doubleClick` (boolean, optional): Whether to perform a double click instead of a single click
    - `button` (string, optional): Button to click, defaults to left
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Title: Close browser
  - Description: Close the page
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_console_messages**
  - Title: Get console messages
  - Description: Returns all console messages
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_diagnose**
  - Title: Diagnose page
  - Description: Analyze page complexity and performance characteristics. Reports on: iframe count, DOM size, modal states, element statistics. Use for: debugging slow pages, understanding page structure, or monitoring page complexity.
  - Parameters:
    - `searchForElements` (object, optional): Search for specific elements and include them in the report
    - `includePerformanceMetrics` (boolean, optional): Include performance metrics in the report
    - `includeAccessibilityInfo` (boolean, optional): Include accessibility information
    - `includeTroubleshootingSuggestions` (boolean, optional): Include troubleshooting suggestions
    - `diagnosticLevel` (string, optional): Level of diagnostic detail: none (no diagnostics), basic (critical only), standard (default), detailed (with metrics), full (all info)
    - `useParallelAnalysis` (boolean, optional): Use Phase 2 parallel analysis for improved performance and resource monitoring
    - `useUnifiedSystem` (boolean, optional): Use Phase 3 unified diagnostic system with enhanced error handling and monitoring
    - `configOverrides` (object, optional): Runtime configuration overrides for diagnostic system
    - `includeSystemStats` (boolean, optional): Include unified system statistics and health information
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Title: Drag mouse
  - Description: Perform drag and drop between two elements.expectation:{includeSnapshot:true,snapshotOptions:{selector:".drop-zone"}} to verify drop result.diffOptions:{enabled:true} shows only what moved.CONSIDER batch_execute if part of larger workflow.
  - Parameters:
    - `startElement` (string): Human-readable source element description used to obtain the permission to interact with the element
    - `startRef` (string): Exact source element reference from the page snapshot
    - `endElement` (string): Human-readable target element description used to obtain the permission to interact with the element
    - `endRef` (string): Exact target element reference from the page snapshot
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element.Returns evaluation result.USE CASES:extract data,modify DOM,trigger events.expectation:{includeSnapshot:false} for data extraction,true if modifying page.element+ref to run on specific element.CONSIDER batch_execute for multiple evaluations.
  - Parameters:
    - `function` (string): () => { /* code */ } or (element) => { /* code */ } when element is provided
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string, optional): Exact target element reference from the page snapshot
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files to file input.paths:["/path/file1.jpg","/path/file2.pdf"] for multiple files.expectation:{includeSnapshot:true,snapshotOptions:{selector:"form"}} to verify upload.Must be triggered after file input interaction.USE batch_execute for click→upload workflows.
  - Parameters:
    - `paths` (array): The absolute paths to the files to upload. Can be a single file or multiple files.
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_find_elements**
  - Title: Find elements
  - Description: Find elements on the page using multiple search criteria such as text, role, tag name, or attributes. Returns matching elements sorted by confidence.
  - Parameters:
    - `searchCriteria` (object): Search criteria for finding elements
    - `maxResults` (number, optional): Maximum number of results to return
    - `includeDiagnosticInfo` (boolean, optional): Include diagnostic information about the page
    - `useUnifiedSystem` (boolean, optional): Use unified diagnostic system for enhanced error handling
    - `enableEnhancedDiscovery` (boolean, optional): Enable enhanced element discovery with contextual suggestions
    - `performanceThreshold` (number, optional): Performance threshold in milliseconds for element discovery
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Title: Handle a dialog
  - Description: Handle a dialog(alert,confirm,prompt).accept:true to accept,false to dismiss.promptText:"answer" for prompt dialogs.expectation:{includeSnapshot:true} to see page after dialog handling.USE batch_execute if dialog appears during workflow.
  - Parameters:
    - `accept` (boolean): Whether to accept the dialog.
    - `promptText` (string, optional): The text of the prompt in case of a prompt dialog.
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Title: Hover mouse
  - Description: Hover over element on page.expectation:{includeSnapshot:true} to capture tooltips/dropdown menus,false for simple hover.snapshotOptions:{selector:".tooltip"} to focus on tooltip area.Often followed by click - use batch_execute for hover→click sequences.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL.expectation:{includeSnapshot:true} to see what loaded,false if you know what to do next.snapshotOptions:{selector:"#content"} to focus on main content(saves 50% tokens).diffOptions:{enabled:true} when revisiting pages to see only changes.CONSIDER batch_execute for navigate→interact workflows.
  - Parameters:
    - `url` (string): The URL to navigate to
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Title: Go back
  - Description: Go back to previous page.expectation:{includeSnapshot:true} to see previous page,false if continuing workflow.diffOptions:{enabled:true} shows only what changed from forward page.USE batch_execute for back→interact sequences.
  - Parameters:
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_forward**
  - Title: Go forward
  - Description: Go forward to next page.expectation:{includeSnapshot:true} to see next page,false if continuing workflow.diffOptions:{enabled:true} shows only what changed from previous page.USE batch_execute for forward→interact sequences.
  - Parameters:
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_requests**
  - Title: List network requests
  - Description: Returns all network requests since loading the page
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard.Common keys:Enter,Escape,ArrowUp/Down/Left/Right,Tab,Backspace.expectation:{includeSnapshot:false} for navigation keys,true for content changes.CONSIDER batch_execute for multiple key presses.
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Title: Resize browser window
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Title: Select option
  - Description: Select option in dropdown.values:["option1","option2"] for multi-select.expectation:{includeSnapshot:false} when part of form filling(use batch),true to verify selection.snapshotOptions:{selector:"form"} for form context.USE batch_execute for form workflows with multiple selects.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of current page.AVOID calling directly - use expectation:{includeSnapshot:true} on other tools instead.USE CASES:Initial page inspection,debugging when other tools didn't capture needed info.snapshotOptions:{selector:"#content"} to focus on specific area.
  - Parameters:
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Title: Take a screenshot
  - Description: Take a screenshot of current page.Returns image data.expectation:{includeSnapshot:false} to avoid redundant accessibility tree(screenshot≠snapshot).imageOptions:{quality:50,format:"jpeg"} for 70% size reduction.fullPage:true for entire page,element+ref for specific element.USE CASES:visual verification,documentation,error capture.
  - Parameters:
    - `type` (string, optional): Image format for the screenshot. Default is png.
    - `filename` (string, optional): File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.
    - `element` (string, optional): Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.
    - `ref` (string, optional): Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.
    - `fullPage` (boolean, optional): When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Title: Type text
  - Description: Type text into editable element.FOR FORMS:Use batch_execute to fill multiple fields efficiently.slowly:true for auto-complete fields,submit:true to press Enter after.expectation:{includeSnapshot:false} when filling multiple fields(use batch),true for final verification.snapshotOptions:{selector:"form"} to focus on form only.diffOptions:{enabled:true} shows only what changed in form.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear/disappear or time to pass.PREFER text-based wait over time for reliability.For loading states:wait for text:"Loading..." textGone:true.For dynamic content:wait for specific text to appear.expectation:{includeSnapshot:true,snapshotOptions:{selector:"#status"},diffOptions:{enabled:true}} shows only what changed.AVOID:fixed time waits unless necessary.
  - Parameters:
    - `time` (number, optional): The time to wait in seconds
    - `text` (string, optional): The text to wait for
    - `textGone` (string, optional): The text to wait for to disappear
    - `expectation` (object, optional): undefined
  - Read-only: **true**

</details>

<details>
<summary><b>Tab management</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_close**
  - Title: Close a tab
  - Description: Close a tab.index:N to close specific tab,omit to close current.expectation:{includeSnapshot:false} usually sufficient,true to verify remaining tabs.USE batch_execute for multi-tab cleanup.
  - Parameters:
    - `index` (number, optional): The index of the tab to close. Closes current tab if not provided.
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_list**
  - Title: List tabs
  - Description: List browser tabs.Always returns tab list with titles and URLs.expectation:{includeSnapshot:false} for just tab info,true to also see current tab content.USE before tab_select to find right tab.
  - Parameters:
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_new**
  - Title: Open a new tab
  - Description: Open a new tab.url:"https://example.com" to navigate immediately,omit for blank tab.expectation:{includeSnapshot:true} to see new tab,false if opening for later use.CONSIDER batch_execute for new_tab→navigate→interact.
  - Parameters:
    - `url` (string, optional): The URL to navigate to in the new tab. If not provided, the new tab will be blank.
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_select**
  - Title: Select a tab
  - Description: Select a tab by index.expectation:{includeSnapshot:true} to see selected tab content,false if you know what's there.USE batch_execute for tab_select→interact workflows.
  - Parameters:
    - `index` (number): The index of the tab to select
    - `expectation` (object, optional): undefined
  - Read-only: **true**

</details>

<details>
<summary><b>Browser installation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_install**
  - Title: Install the browser specified in the config
  - Description: Install the browser specified in the config. Call this if you get an error about the browser not being installed.
  - Parameters: None
  - Read-only: **false**

</details>

<details>
<summary><b>Coordinate-based (opt-in via --caps=vision)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_click_xy**
  - Title: Click
  - Description: Click at specific coordinates.Requires --caps=vision.x,y:click position.expectation:{includeSnapshot:true} to verify result.PREFER browser_click with element ref over coordinates.USE batch_execute for coordinate-based workflows.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_drag_xy**
  - Title: Drag mouse
  - Description: Drag from one coordinate to another.Requires --caps=vision.startX,startY→endX,endY.expectation:{includeSnapshot:true,snapshotOptions:{selector:".drop-zone"}} to verify.PREFER browser_drag with element refs over coordinates.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `startX` (number): Start X coordinate
    - `startY` (number): Start Y coordinate
    - `endX` (number): End X coordinate
    - `endY` (number): End Y coordinate
    - `expectation` (object, optional): undefined
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_move_xy**
  - Title: Move mouse
  - Description: Move mouse to specific coordinates.Requires --caps=vision.x,y:coordinates.expectation:{includeSnapshot:false} for simple move,true to see hover effects.PREFER element-based interactions over coordinates when possible.
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): undefined
  - Read-only: **true**

</details>

<details>
<summary><b>PDF generation (opt-in via --caps=pdf)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Title: Save as PDF
  - Description: Save page as PDF
  - Parameters:
    - `filename` (string, optional): File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.
  - Read-only: **true**

</details>


<!--- End of tools generated section -->

## Token Optimization Features

Playwright MCP server includes advanced token optimization features to reduce token usage and improve performance through response filtering and batch execution.

### Response Filtering with Expectation Parameter

All browser tools support an optional `expectation` parameter that controls what information is included in the response. This can significantly reduce token usage by excluding unnecessary data.

#### Basic Usage

```javascript
// Standard call - includes all information (snapshot, console, tabs, etc.)
await browser_navigate({ url: 'https://example.com' });

// Optimized call - only includes essential information
await browser_navigate({ 
  url: 'https://example.com',
  expectation: {
    includeSnapshot: false,  // Skip page snapshot
    includeConsole: false,   // Skip console messages
    includeTabs: false       // Skip tab information
  }
});
```

#### Expectation Options

- **`includeSnapshot`** (boolean, default: varies by tool): Include page accessibility snapshot
- **`includeConsole`** (boolean, default: varies by tool): Include browser console messages
- **`includeDownloads`** (boolean, default: true): Include download information
- **`includeTabs`** (boolean, default: varies by tool): Include tab information
- **`includeCode`** (boolean, default: true): Include executed code in response

#### Advanced Snapshot Options

```javascript
await browser_click({
  element: 'Login button',
  ref: '#login-btn',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '.dashboard',  // Only capture dashboard area
      maxLength: 1000,         // Limit snapshot length
      format: 'text'           // Use text format instead of aria
    }
  }
});
```

#### Console Filtering Options

```javascript
await browser_navigate({
  url: 'https://example.com',
  expectation: {
    includeConsole: true,
    consoleOptions: {
      levels: ['error', 'warn'],     // Only errors and warnings
      maxMessages: 5,                // Limit to 5 messages
      patterns: ['^Error:'],         // Filter by regex patterns
      removeDuplicates: true         // Remove duplicate messages
    }
  }
});
```

### Batch Execution

Execute multiple browser actions in a single request with optimized response handling and flexible error control.

#### Basic Batch Execution

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com/login' }
    },
    {
      tool: 'browser_type',
      arguments: { 
        element: 'username field', 
        ref: '#username', 
        text: 'testuser' 
      }
    },
    {
      tool: 'browser_type',
      arguments: { 
        element: 'password field', 
        ref: '#password', 
        text: 'password' 
      }
    },
    {
      tool: 'browser_click',
      arguments: { element: 'login button', ref: '#login-btn' }
    }
  ]
});
```

#### Advanced Batch Configuration

```javascript
await browser_batch_execute({
  steps: [
    {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com' },
      expectation: { includeSnapshot: false },  // Step-specific optimization
      continueOnError: true                     // Continue if this step fails
    },
    {
      tool: 'browser_click',
      arguments: { element: 'button', ref: '#submit' },
      expectation: { 
        includeSnapshot: true,
        snapshotOptions: { selector: '.result-area' }
      }
    }
  ],
  stopOnFirstError: false,           // Continue executing remaining steps
  globalExpectation: {               // Default for all steps
    includeConsole: false,
    includeTabs: false
  }
});
```

#### Error Handling Options

- **`continueOnError`** (per step): Continue batch execution even if this step fails
- **`stopOnFirstError`** (global): Stop entire batch on first error
- Flexible combination allows for robust automation workflows

### Tool-Specific Defaults

Each tool has optimized defaults based on typical usage patterns:

- **Navigation tools** (`browser_navigate`): Include full context for verification
- **Interactive tools** (`browser_click`, `browser_type`): Include snapshot but minimal logging
- **Screenshot/snapshot tools**: Exclude additional context
- **Code evaluation**: Include console output but minimal other info
- **Wait operations**: Minimal output for efficiency

### Performance Benefits

- **Token Reduction**: 50-80% reduction in token usage with optimized expectations
- **Faster Execution**: 2-5x speed improvement with batch execution
- **Reduced Latency**: Fewer round trips between client and server
- **Cost Optimization**: Lower API costs due to reduced token consumption

### Response Diff Detection

The Fast Server includes automatic diff detection to efficiently track changes between consecutive tool executions:

```javascript
// Enable diff detection for any tool
await browser_click({
  element: 'Load more button',
  ref: '#load-more',
  expectation: {
    includeSnapshot: true,
    diffOptions: {
      enabled: true,
      threshold: 0.1,         // Show diff if >10% changed
      format: 'unified',      // or 'split', 'minimal'
      maxDiffLines: 50,       // Limit diff output size
      context: 3              // Lines of context around changes
    }
  }
});
```

#### Diff Detection Benefits

- **Minimal token usage**: Only changed content is shown instead of full snapshots
- **Change tracking**: Automatically detects what changed after actions
- **Flexible formats**: Choose between unified, split, or minimal diff formats
- **Smart caching**: Compares against previous response from the same tool

#### When to Use Diff Detection

1. **UI interactions without navigation**: Clicks, typing, hover effects
2. **Dynamic content updates**: Loading more items, real-time updates
3. **Form interactions**: Track changes as users fill forms
4. **Selective monitoring**: Use with CSS selectors to track specific areas

```javascript
// Example: Track only search results changes
await browser_type({
  element: 'Search input',
  ref: '#search',
  text: 'playwright',
  expectation: {
    includeSnapshot: true,
    snapshotOptions: {
      selector: '#search-results'  // Only monitor results area
    },
    diffOptions: {
      enabled: true,
      format: 'minimal'  // Just show what changed
    }
  }
});
```

### Best Practices

1. **Use batch execution** for multi-step workflows
2. **Enable diff detection** for actions without page navigation
3. **Disable snapshots** for intermediate steps that don't need verification
4. **Use selective snapshots** with CSS selectors for large pages
5. **Filter console messages** to relevant levels only
6. **Combine global and step-specific expectations** for fine-grained control
7. **Use minimal diff format** for maximum token savings

### Diagnostic System Examples

**Find alternative elements when selectors fail:**
```json
{
  "name": "browser_find_elements",
  "arguments": {
    "searchCriteria": {
      "text": "Submit",
      "role": "button"
    },
    "maxResults": 5
  }
}
```

**Generate comprehensive page diagnostics:**
```json
{
  "name": "browser_diagnose",
  "arguments": {
    "includePerformanceMetrics": true,
    "includeAccessibilityInfo": true,
    "includeTroubleshootingSuggestions": true
  }
}
```

**Debug automation failures with enhanced errors:**
All tools automatically provide enhanced error messages with:
- Alternative element suggestions
- Page structure analysis
- Context-aware troubleshooting tips
- Performance insights

### Migration Guide

Existing code continues to work without changes. To optimize:

1. Start by adding `expectation: { includeSnapshot: false }` to intermediate steps
2. Use batch execution for sequences of 3+ operations
3. Gradually fine-tune expectations based on your specific needs
4. Use diagnostic tools when automation fails or needs debugging
