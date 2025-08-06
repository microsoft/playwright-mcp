# Request Logging

The fast-playwright-mcp server supports request logging for debugging and monitoring purposes.

## Logging Modes

### 1. Debug Mode (Console Output)
Uses the standard `debug` npm package. Output goes to stderr.

```bash
# Enable all debug logs
DEBUG=pw:mcp:* node cli.js

# Enable only request logs
DEBUG=pw:mcp:requests node cli.js

# Enable multiple specific logs
DEBUG=pw:mcp:requests,pw:mcp:errors node cli.js
```

### 2. File Logging Mode
Logs requests to `logs/mcp-requests.log` file.

```bash
# Enable file logging only
PLAYWRIGHT_MCP_LOG_REQUESTS=file node cli.js

# Enable both debug and file logging
PLAYWRIGHT_MCP_LOG_REQUESTS=both DEBUG=pw:mcp:requests node cli.js
```

## Available Debug Namespaces

- `pw:mcp:requests` - MCP tool requests
- `pw:mcp:errors` - Error logging
- `pw:mcp:test` - Test/debug logging
- `pw:mcp:relay` - CDP relay logging (for extensions)

## Log File Format

When file logging is enabled, requests are logged in human-readable format:

```
[2025-01-05T23:43:50.675Z] === MCP Server Started ===
Process ID: 12345
Node Version: v22.16.0
Log Mode: file
---
[2025-01-05T23:43:51.123Z] Tool: browser_navigate (ID: abc123)
Parameters: {
  "url": "https://example.com",
  "expectation": {
    "includeSnapshot": false
  }
}
---
```

## Examples

```bash
# Development: Debug output only
DEBUG=pw:mcp:* node cli.js

# Testing: Log to file for later analysis
PLAYWRIGHT_MCP_LOG_REQUESTS=file node cli.js

# Production monitoring: Both debug and file
PLAYWRIGHT_MCP_LOG_REQUESTS=both DEBUG=pw:mcp:requests,pw:mcp:errors node cli.js
```

## Notes

- Log files are automatically ignored by git (included in .gitignore)
- File logging creates `logs/` directory automatically
- Logging failures don't interfere with normal operation