## Playwright MCP

A Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev). This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

### Key Features

- **Fast and lightweight**: Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**: No vision models needed, operates purely on structured data.
- **Deterministic tool application**: Avoids ambiguity common with screenshot-based approaches.

### Use Cases

- Web navigation and form-filling
- Data extraction from structured content
- Automated testing driven by LLMs
- General-purpose browser interaction for agents

<!--
// Generate using?:
node utils/generate_links.js
-->

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

### Example config

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

### Table of Contents

- [Installation in VS Code](#installation-in-vs-code)
- [Command line](#command-line)
- [User profile](#user-profile)
- [Configuration file](#configuration-file)
- [Running on Linux](#running-on-linux)
- [Docker](#docker)
- [Programmatic usage](#programmatic-usage)
- [Tool modes](#tool-modes)

### Installation in VS Code

You can install the Playwright MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

After installation, the Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.

### Command line

The Playwright MCP server supports the following command-line options:

- `--browser <browser>`: Browser or chrome channel to use. Possible values:
  - `chrome`, `firefox`, `webkit`, `msedge`
  - Chrome channels: `chrome-beta`, `chrome-canary`, `chrome-dev`
  - Edge channels: `msedge-beta`, `msedge-canary`, `msedge-dev`
  - Default: `chrome`
- `--caps <caps>`: Comma-separated list of capabilities to enable, possible values: tabs, pdf, history, wait, files, install. Default is all.
- `--cdp-endpoint <endpoint>`: CDP endpoint to connect to
- `--executable-path <path>`: Path to the browser executable
- `--headless`: Run browser in headless mode (headed by default)
- `--user-data-dir <path>`: Path to the user data directory
- `--port <port>`: Port to listen on for SSE transport
- `--host <host>`: Host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.
- `--vision`: Run server that uses screenshots (Aria snapshots are used by default)
- `--config <path>`: Path to the configuration file

### User profile

Playwright MCP will launch the browser with the new profile, located at

```
- `%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile` on Windows
- `~/Library/Caches/ms-playwright/mcp-{channel}-profile` on macOS
- `~/.cache/ms-playwright/mcp-{channel}-profile` on Linux
```

All the logged in information will be stored in that profile, you can delete it between sessions if you'd like to clear the offline state.

### Configuration file

The Playwright MCP server can be configured using a JSON configuration file. Here's the complete configuration format:

```typescript
{
  // Browser configuration
  browser?: {
    // Browser type to use (chromium, firefox, or webkit)
    browserName?: 'chromium' | 'firefox' | 'webkit';
    
    // Path to user data directory for browser profile persistence
    userDataDir?: string;
    
    // Browser launch options (see Playwright docs)
    launchOptions?: {
      channel?: string;        // Browser channel (e.g. 'chrome')
      headless?: boolean;      // Run in headless mode
      executablePath?: string; // Path to browser executable
      // ... other Playwright launch options
    };
    
    // Browser context options
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

  // List of enabled capabilities
  capabilities?: Array<
    'core' |    // Core browser automation
    'tabs' |    // Tab management
    'pdf' |     // PDF generation
    'history' | // Browser history
    'wait' |    // Wait utilities
    'files' |   // File handling
    'install'   // Browser installation
  >;

  // Enable vision mode (screenshots instead of accessibility snapshots)
  vision?: boolean;

  // Directory for output files
  outputDir?: string;

  // Tool-specific configurations
  tools?: {
    browser_take_screenshot?: {
      // Disable base64-encoded image responses
      omitBase64?: boolean;
    }
  }
}
```

You can specify the configuration file using the `--config` command line option:

```bash
npx @playwright/mcp@latest --config path/to/config.json
```

### Running on Linux

When running headless without DISPLAY, pass `--headless` command line argument.

When running headed browser on system w/o display or from worker processes of the IDEs,
run the MCP server from environment with the DISPLAY and pass the `--port` flag to enable SSE transport.

```bash
npx @playwright/mcp@latest --port 8931
```

And then in MCP client config, set the `url` to the SSE endpoint:

```js
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/sse"
    }
  }
}
```

### Docker

**NOTE:** The Docker implementation only supports headless chromium at the moment.

```js
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "mcp/playwright"]
    }
  }
}
```

You can build the Docker image yourself.

```
docker build -t mcp/playwright .
```

### Programmatic usage

```js
import http from 'http';

import { createServer } from '@playwright/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

http.createServer(async (req, res) => {
  // ...

  // Creates a headless Playwright MCP server with SSE transport
  const mcpServer = await createServer({ headless: true });
  const transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);

  // ...
});
```

### Tool modes

The tools are available in two modes:

1. **Snapshot Mode** (default): Uses accessibility snapshots for better performance and reliability
2. **Vision Mode**: Uses screenshots for visual-based interactions

To use Vision Mode, add the `--vision` flag when starting the server:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--vision"
      ]
    }
  }
}
```

Vision Mode works best with the computer use models that are able to interact with elements using
X Y coordinate space, based on the provided screenshot.


<!--- Generated by update-readme.js -->

### Snapshot-based Interactions

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters: None

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_click**
  - Description: Perform click on a web page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Description: Perform drag and drop between two elements
  - Parameters:
    - `startElement` (string): Human-readable source element description used to obtain the permission to interact with the element
    - `startRef` (string): Exact source element reference from the page snapshot
    - `endElement` (string): Human-readable target element description used to obtain the permission to interact with the element
    - `endRef` (string): Exact target element reference from the page snapshot

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Description: Hover over element on page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Description: Type text into editable element
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Description: Select an option in a dropdown
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Description: Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.
  - Parameters:
    - `raw` (boolean, optional): Whether to return without compression (in PNG format). Default is false, which returns a JPEG image.
    - `element` (string, optional): Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.
    - `ref` (string, optional): Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.

### Vision-based Interactions

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_screen_capture**
  - Description: Take a screenshot of the current page
  - Parameters: None

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_screen_move_mouse**
  - Description: Move mouse to a given position
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `x` (number): X coordinate
    - `y` (number): Y coordinate

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_screen_click**
  - Description: Click left mouse button
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `x` (number): X coordinate
    - `y` (number): Y coordinate

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_screen_drag**
  - Description: Drag left mouse button
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `startX` (number): Start X coordinate
    - `startY` (number): Start Y coordinate
    - `endX` (number): End X coordinate
    - `endY` (number): End Y coordinate

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_screen_type**
  - Description: Type text
  - Parameters:
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)

### Tab Management

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_list**
  - Description: List browser tabs
  - Parameters: None

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_new**
  - Description: Open a new tab
  - Parameters:
    - `url` (string, optional): The URL to navigate to in the new tab. If not provided, the new tab will be blank.

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_select**
  - Description: Select a tab by index
  - Parameters:
    - `index` (number): The index of the tab to select

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_close**
  - Description: Close a tab
  - Parameters:
    - `index` (number, optional): The index of the tab to close. Closes current tab if not provided.

### Navigation

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Description: Go back to the previous page
  - Parameters: None

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_forward**
  - Description: Go forward to the next page
  - Parameters: None

### Keyboard

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`

### Console

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_console_messages**
  - Description: Returns all console messages
  - Parameters: None

### Files and Media

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Description: Upload one or multiple files
  - Parameters:
    - `paths` (array): The absolute paths to the files to upload. Can be a single file or multiple files.

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Description: Save page as PDF
  - Parameters: None

### Utilities

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Description: Close the page
  - Parameters: None

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait**
  - Description: Wait for a specified time in seconds
  - Parameters:
    - `time` (number): The time to wait in seconds

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_install**
  - Description: Install the browser specified in the config. Call this if you get an error about the browser not being installed.
  - Parameters: None

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Description: Handle a dialog
  - Parameters:
    - `accept` (boolean): Whether to accept the dialog.
    - `promptText` (string, optional): The text of the prompt in case of a prompt dialog.

<!--- End of generated section -->
