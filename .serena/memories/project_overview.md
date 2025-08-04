# Playwright MCP Server - Project Overview

## Purpose
A Model Context Protocol (MCP) server that provides browser automation capabilities using Playwright. This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

## Key Features
- Fast and lightweight - uses Playwright's accessibility tree, not pixel-based input
- LLM-friendly - operates purely on structured data
- Deterministic tool application - avoids ambiguity common with screenshot-based approaches

## Tech Stack
- **Language**: TypeScript/Node.js
- **Framework**: Playwright for browser automation
- **MCP SDK**: @modelcontextprotocol/sdk for server functionality
- **Schema Validation**: Zod with zod-to-json-schema
- **Build Tool**: TypeScript compiler (tsc)
- **Testing**: Playwright Test
- **Package Manager**: npm

## Project Structure
```
/
├── src/                 # Main source code
│   ├── mcp/            # MCP server implementation
│   ├── tools/          # Tool implementations (click, type, navigate, etc.)
│   ├── extension/      # Extension-related code
│   ├── loopTools/      # Loop tools
│   └── loop/           # Loop functionality
├── docs/               # Documentation including design docs
├── examples/           # Usage examples
├── tests/              # Test files
├── utils/              # Utility scripts
└── extension/          # Browser extension code
```

## Core Components
1. **Server Backend** (`src/mcp/server.ts`): Main MCP server implementation
2. **Tools** (`src/tools/`): Individual browser automation tools
3. **Response System** (`src/response.ts`): Tool response handling and serialization
4. **Context Management** (`src/context.ts`): Browser context and tab management
5. **Configuration** (`src/config.ts`): Server configuration handling

## Available Tools
- Core automation: click, type, navigate, screenshot, snapshot, evaluate
- Tab management: new tab, close tab, switch tab, list tabs
- Browser installation: install browser
- Coordinate-based actions (opt-in via --caps=vision)
- PDF generation (opt-in via --caps=pdf)

## Current Performance Issues
- Token consumption is high due to verbose responses including snapshots and console messages
- Multiple round-trip communications slow down complex automation sequences
- Response filtering is not implemented, leading to unnecessary data transmission