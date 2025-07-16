# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Tasks

### Building the Project
```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode for development
npm run watch

# Clean build artifacts
npm run clean
```

### Running Tests
```bash
# Run all tests
npm test

# Run browser-specific tests
npm run ctest  # Chrome only
npm run ftest  # Firefox only
npm run wtest  # WebKit only

# Run a single test file
npx playwright test tests/your-test.spec.ts

# Run tests in headed mode
npx playwright test --headed

# Debug tests
npx playwright test --debug
```

### Linting and Code Quality
```bash
# Run linting and type checking
npm run lint

# Update README with generated tool documentation
npm run update-readme
```

### Running the Server
```bash
# Start the MCP server locally
npm run run-server

# Or use the installed binary
mcp-server-playwright

# Run with specific options
mcp-server-playwright --port 8931 --headless
```

## Architecture Overview

### MCP Server Structure
The Playwright MCP server implements the Model Context Protocol to provide browser automation capabilities. The architecture follows a modular design:

1. **Entry Points**:
   - `src/program.ts` - CLI entry point that parses command-line arguments
   - `src/index.ts` - Programmatic API for embedding the server
   - `src/server.ts` - Core server class managing browser contexts and connections

2. **Transport Layer** (`src/transport.ts`):
   - Supports STDIO (default) and HTTP/SSE transports
   - Handles connection lifecycle and message routing

3. **Tool System** (`src/tools/`):
   - Each tool is a separate module implementing a specific browser operation
   - Tools use Zod schemas for validation and are registered dynamically
   - Two modes: Snapshot (accessibility-based) and Vision (screenshot-based)

4. **Browser Management**:
   - `src/browserContextFactory.ts` - Creates browser contexts with proper configuration
   - `src/context.ts` - Manages page lifecycle and tool execution
   - Supports persistent profiles or isolated sessions

### Key Design Patterns

1. **Schema-Driven Tools**: All tools define Zod schemas that are converted to JSON Schema for the MCP protocol. This ensures type safety and automatic validation.

2. **Capability-Based Architecture**: Tools are grouped into capabilities (core, tabs, pdf, etc.) that can be selectively enabled via configuration.

3. **Two Interaction Modes**:
   - **Snapshot Mode**: Uses Playwright's accessibility tree for element identification
   - **Vision Mode**: Uses screenshots and coordinates for visual-based interaction

4. **Error Handling**: Tools throw specific error types that are translated to appropriate MCP error responses.

## Testing Approach

The project uses Playwright Test framework with custom fixtures:

1. **Test Server**: A local HTTPS server (`tests/testserver/`) provides test pages
2. **MCP Test Client**: Custom test client that communicates with the server
3. **Browser Fixtures**: Automatically manage browser lifecycle for tests

To debug failing tests:
```bash
# Run with debug output
DEBUG=pw:mcp* npm test

# Use Playwright's debug mode
npx playwright test --debug

# Generate trace for debugging
npx playwright test --trace on
```

## Important Notes

- When modifying tools, update both the tool implementation and its schema
- Run `npm run update-readme` after adding or modifying tools to regenerate documentation
- The server supports multiple concurrent connections, each with its own browser context
- Browser contexts can be persistent (default) or isolated based on configuration
- The project uses ES modules throughout - ensure imports include file extensions