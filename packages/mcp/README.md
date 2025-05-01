
## limetest MCP Server

A Model Context Protocol (MCP) server powered by [Playwright](https://playwright.dev) that streamlinse end to end testing for your MCP client.

### Use Cases

- Automated testing planned and executed by LLMs

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
        "limetest": {
            "command": "npx",
            "args": [
                "npx @limetest/mcp",
                "--api-key=<your openai api key>"
            ]
        }
    }
}
```

### User data directory

limtest MCP will launch Chrome browser with the new profile, located at

```
- `%USERPROFILE%\AppData\Local\ms-limetest\mcp-chrome-profile` on Windows
- `~/Library/Caches/ms-limetest/mcp-chrome-profile` on macOS
- `~/.cache/ms-limetest/mcp-chrome-profile` on Linux
```

All the logged in information will be stored in that profile, you can delete it between sessions if you'd like to clear the offline state.

## Acknowledgements

Limetest is based on [Microsoft's Playwright MCP](https://github.com/microsoft/playwright-mcp) and optimized for automated end-to-end testing as a standalone framework. This project is distributed under the Apache 2.0 License.
