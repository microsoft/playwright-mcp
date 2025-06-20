# Playwright MCP Go

A Go implementation of the Playwright Model Context Protocol (MCP) server.

## Overview

This project provides browser automation capabilities using [Playwright](https://playwright.dev) through the Model Context Protocol. It enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

## Features

- **Fast and lightweight**. Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**. No vision models needed, operates purely on structured data.
- **Deterministic tool application**. Avoids ambiguity common with screenshot-based approaches.

## Requirements

- Go 1.20 or newer
- Playwright for Go

## Installation

```bash
# Clone the repository
git clone https://github.com/microsoft/playwright-mcp-go.git
cd playwright-mcp-go

# Install dependencies
make install-deps

# Build the project
make build
```

## Usage

```bash
# Run the server
./bin/playwright-mcp

# Run with custom port
./bin/playwright-mcp --port 8080

# Run with custom config file
./bin/playwright-mcp --config config.json

# Enable debug logging
./bin/playwright-mcp --debug
```

## Configuration

You can provide a configuration file in JSON format:

```json
{
  "browser": {
    "name": "chromium",
    "headless": false,
    "args": ["--disable-gpu"]
  }
}
```

## Development

```bash
# Run tests
make test

# Clean build artifacts
make clean
```

## License

Licensed under the Apache License, Version 2.0.
