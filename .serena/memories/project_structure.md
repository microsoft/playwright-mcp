# Project Structure

## Root Directory
```
/Users/tomohiko/fast-playwright-mcp/
├── src/                    # TypeScript source code
├── lib/                    # Compiled JavaScript (gitignored)
├── tests/                  # Playwright tests
├── examples/               # Usage examples
├── extension/              # Browser extension
├── utils/                  # Utility scripts
├── .github/                # GitHub Actions configuration
└── .serena/                # serena memory files

## Main Files
├── cli.js                  # CLI entry point
├── index.js                # API entry point
├── index.d.ts              # TypeScript type definitions
├── package.json            # Project configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
└── playwright.config.ts    # Playwright test configuration
```

## src Directory Structure
```
src/
├── index.ts                # Main API (createConnection, SimpleBrowserContextFactory)
├── program.ts              # CLI program
├── context.ts              # Browser context management
├── tools.ts                # MCP tool definitions
├── tab.ts                  # Tab management
├── utils.ts                # Utility functions
├── config.ts               # Configuration management
├── tools/                  # Individual tool implementations
├── mcp/                    # MCP server implementation
├── loop/                   # Loop processing related
└── extension/              # Extension related
```

## Important Modules
- **context.ts**: Browser context and page management
- **tools.ts**: MCP tool definitions and implementations
- **mcp/**: MCP protocol server implementation
- **browserContextFactory.ts**: Browser instance creation