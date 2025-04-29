# Litest

Litest end to end testing framework with AI capabilities. Define your test cases in natural language and let AI handle the execution. 

## Installation

```bash
npm install litest
```

## Usage

### Run Tests
Use --headless for running tests headlessly in CI workflows

```bash
npx litest example
```


## litest MCP Server

https://github.com/user-attachments/assets/b801f239-dc66-4b3b-bcf2-42e2a9a68721

A Model Context Protocol (MCP) server powered by [Playwright](https://playwright.dev) that provides automated end-to-end testing with dedicated LLM-driven test validation, separating testing concerns from the MCP client.

Note: This MCP is forked from Microsoft's [Playwright MCP](https://github.com/microsoft/playwright-mcp). We optimized Playwright MCP for automated end to end testing.

### Key Features

- **Fast and lightweight**: Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**: No vision models needed, operates purely on structured data.
- **Deterministic tool application**: Avoids ambiguity common with screenshot-based approaches.

### Use Cases

- Automated testing driven by LLMs

### Example config

After cloning this repo, build and add the E2E MCP server to your MCP Client as such:
Notice that you need OpenAI API key to run this MCP server in end to end mode.

```bash
npm install
npx playwright install
npm run build
```

Then:

```js
{
    "mcpServers": {
        "e2e": {
            "command": "node",
            "args": [
                "/Users/Documents/projects/e2e-mcp/lib/program.js",
                "--endtoend",
                "--api-key=<your openai api key>"
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
