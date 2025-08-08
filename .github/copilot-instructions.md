---
applyTo: "**/*.{ts,tsx,js,jsx}"
---

# Fast Playwright MCP - GitHub Copilot Instructions

## Project Context
This is the Fast Playwright MCP Server project - a TypeScript/JavaScript automation tool using Playwright for browser automation via MCP (Model Context Protocol).

## Key Principles
- Use Biome (via Ultracite) for consistent formatting and linting
- Follow existing patterns in the codebase
- Prioritize type safety and error handling
- Write comprehensive tests

## Coding Guidelines

### TypeScript Best Practices
- Use strict type definitions
- Prefer `import type` for types
- Use `const` assertions where appropriate
- Avoid `any` type - use proper typing

### Error Handling
- Always handle errors appropriately
- Use proper error types and messages
- Log errors for debugging
- Don't swallow exceptions

### Testing
- Write comprehensive tests for new features
- Use Playwright's built-in test utilities
- Mock external dependencies appropriately
- Test both success and error paths

### MCP Protocol
- Follow MCP specification for tool definitions
- Provide clear tool descriptions and parameters
- Handle MCP transport properly
- Return structured responses

## Project Structure
- `/src/` - Main source code
- `/tests/` - Test files
- `/benchmark/` - Performance benchmarking
- `/extension/` - Browser extension code

## Commands
- `npm run build` - Build TypeScript
- `npm test` - Run Playwright tests  
- `npm run lint-fix` - Format and fix code
- `npm run benchmark` - Run performance tests