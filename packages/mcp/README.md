## limetest MCP Server

https://github.com/user-attachments/assets/b801f239-dc66-4b3b-bcf2-42e2a9a68721

A Model Context Protocol (MCP) server powered by [Playwright](https://playwright.dev) that provides automated end-to-end testing with dedicated LLM-driven test validation, separating testing concerns from the MCP client.

Note: This MCP is forked from Microsoft's [Playwright MCP](https://github.com/microsoft/playwright-mcp). We optimized Playwright MCP for automated end to end testing.

### Use Cases

- Automated testing driven by LLMs

### Example config

After cloning this repo, build and add the E2E MCP server to your MCP Client as such:
Notice that you need OpenAI API key to run this MCP server in end to end mode.

```bash
npm install @limetest/mcp

npx playwright install
```

Then:

```js
{
    "mcpServers": {
        "litest": {
            "command": "node",
            "args": [
                "npx limetest-mcp",
                "--api-key=<your openai api key>"
            ]
        }
    }
}
```

### User data directory

litest MCP will launch Chrome browser with the new profile, located at

```
- `%USERPROFILE%\AppData\Local\ms-playwright\mcp-chrome-profile` on Windows
- `~/Library/Caches/ms-playwright/mcp-chrome-profile` on macOS
- `~/.cache/ms-playwright/mcp-chrome-profile` on Linux
```

All the logged in information will be stored in that profile, you can delete it between sessions if you'dlike to clear the offline state.
