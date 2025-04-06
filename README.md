## End to End testing MCP Server

A Model Context Protocol (MCP) server powered by [Playwright](https://playwright.dev) that provides automated end-to-end testing with dedicated LLM-driven test validation, separating testing concerns from the MCP client.

Note: This MCP is forked from Microsoft's [Playwright MCP](https://github.com/microsoft/playwright-mcp). We optimized Playwright MCP for automated end to end testing.

### Key Features

- **Fast and lightweight**: Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**: No vision models needed, operates purely on structured data.
- **Deterministic tool application**: Avoids ambiguity common with screenshot-based approaches.

### Use Cases

- Automated testing driven by LLMs

### Example config

After cloning this repo, add the E2E MCP server to your MCP Client as such:

```js
{
    "mcpServers": {
        "EndToEnd": {
            "command": "node",
            "args": [
                "/Users/Documents/projects/e2e-mcp/lib/program.js",
                "--endtoend",
                "--api-key=<your api key>"
            ]
        }
    }
}
```

### User data directory

E2E MCP will launch Chrome browser with the new profile, located at

```
- `%USERPROFILE%\AppData\Local\ms-playwright\mcp-chrome-profile` on Windows
- `~/Library/Caches/ms-playwright/mcp-chrome-profile` on macOS
- `~/.cache/ms-playwright/mcp-chrome-profile` on Linux
```

All the logged in information will be stored in that profile, you can delete it between sessions if you'dlike to clear the offline state.