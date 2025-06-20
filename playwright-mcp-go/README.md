# Playwright MCP Server - Go Implementation

This is a Go implementation of the [Playwright MCP Server](https://github.com/microsoft/playwright-mcp).

## Overview

The Playwright MCP Server is a server that implements the Model Context Protocol (MCP) for Playwright. It allows AI models to control a web browser through a standardized interface.

## Features

- Browser control via CDP (Chrome DevTools Protocol)
- Support for Chromium, Firefox, and WebKit browsers
- Support for multiple tabs
- Support for screenshots and snapshots
- Support for keyboard and mouse input
- Support for file uploads and downloads
- Support for network interception
- Support for browser extensions

## Installation

### Requirements

- Go 1.18 or later
- Chrome, Firefox, or WebKit browser

### Building from Source

```bash
git clone https://github.com/microsoft/playwright-mcp-go
cd playwright-mcp-go
go build -o mcp-server-playwright ./cmd/server
```

## Usage

```bash
./mcp-server-playwright --browser chrome --headless
```

### Command-Line Options

#### Browser Options

- `--browser`: Browser to use (chrome, firefox, webkit)
- `--browser-agent`: Browser agent to use
- `--cdp-endpoint`: CDP endpoint to connect to
- `--executable-path`: Path to browser executable
- `--headless`: Run browser in headless mode
- `--isolated`: Run browser in isolated mode
- `--user-data-dir`: Path to user data directory
- `--device`: Device to emulate
- `--viewport-size`: Viewport size (width,height)
- `--user-agent`: User agent to use
- `--no-sandbox`: Disable sandbox
- `--storage-state`: Path to storage state

#### Network Options

- `--allowed-origins`: Allowed origins (comma-separated)
- `--blocked-origins`: Blocked origins (comma-separated)
- `--block-service-workers`: Block service workers
- `--ignore-https-errors`: Ignore HTTPS errors
- `--proxy-server`: Proxy server to use
- `--proxy-bypass`: Proxy bypass list

#### Server Options

- `--port`: Port to listen on (default: 9224)
- `--host`: Host to listen on (default: localhost)

#### Other Options

- `--config`: Path to config file
- `--caps`: Capabilities (comma-separated)
- `--vision`: Enable vision capabilities
- `--extension`: Enable extension mode
- `--save-trace`: Save trace
- `--output-dir`: Output directory
- `--image-responses`: Image responses mode (allow, omit, auto)

## Architecture

The server is built with a modular architecture:

- **cmd/server**: Main entry point for the server
- **internal/browser**: Browser management
- **internal/config**: Configuration handling
- **internal/connection**: MCP connection handling
- **internal/server**: HTTP server implementation
- **internal/tools**: Tool implementations
- **internal/transport**: Transport layer for MCP
- **pkg/mcp**: Public API for the MCP server

## Development Status

This is a work in progress. The following components are implemented:

- [x] Configuration handling
- [x] Server structure
- [ ] Browser management via CDP
- [ ] Tool implementations
- [ ] MCP protocol implementation
- [ ] Transport layer

## License

Apache License 2.0 