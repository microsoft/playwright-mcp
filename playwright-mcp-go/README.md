# Playwright MCP Go Server

This is a Go implementation of the Playwright Model Context Protocol (MCP) server, ported from the original TypeScript version.

## Features
- HTTP endpoints: `/mcp`, `/sse`, `/json/list`, `/json/launch`
- WebSocket endpoints: `/cdp`, `/extension` (stubs)
- Modular structure for future expansion

## Getting Started

### Prerequisites
- Go 1.20 or newer

### Running the Server

```
cd playwright-mcp-go/cmd/mcp-server
# Or from the root: go run ./cmd/mcp-server

go run .
```

The server will listen on port 9224 by default.

## Project Structure
- `cmd/mcp-server/`: Main entry point
- `internal/`: Core server logic, HTTP, WebSocket, tools, config, and utilities

## Next Steps
- Implement endpoint logic and WebSocket relays
- Port core MCP features from TypeScript 