# Playwright MCP Project Overview

## Project Purpose
Provides browser automation capabilities using Playwright as a Model Context Protocol (MCP) server. Enables LLMs to interact with web pages through structured accessibility snapshots without requiring screenshots or vision models.

## Key Features
- **Fast and Lightweight**: Uses Playwright's accessibility tree (not pixel-based input)
- **LLM-Friendly**: No vision models required, works purely with structured data
- **Deterministic Tool Application**: Avoids ambiguity found in screenshot-based approaches

## Supported Clients
- VS Code
- Cursor
- Windsurf
- Claude Desktop
- Goose
- Other MCP clients

## Entry Points
- CLI Entry: `cli.js` → `lib/program.js`
- API Entry: `index.js` → `lib/index.js`
- Type Definitions: `index.d.ts`