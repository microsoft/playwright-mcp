# Suggested Commands List

## Build & Development Commands
- `npm run build` - Compile TypeScript (src → lib)
- `npm run watch` - Watch file changes and auto-build
- `npm run clean` - Remove build artifacts

## Quality Assurance Commands
- `npm run lint` - Run ESLint and TypeScript type checking
- `npm run lint-fix` - Run ESLint with auto-fix
- `npm run test` - Run all Playwright tests
- `npm run ctest` - Run tests in Chrome only
- `npm run ftest` - Run tests in Firefox only
- `npm run wtest` - Run tests in WebKit only

## Other Commands
- `npm run update-readme` - Auto-update README
- `npm run run-server` - Start browser server
- `npm run npm-publish` - Publish npm package (clean → build → test → publish)

## MCP Execution Commands
- `npx @playwright/mcp@latest` - Start MCP server
- `npx @playwright/mcp@latest --help` - Show help
- `npx @playwright/mcp@latest --headless` - Run in headless mode
- `npx @playwright/mcp@latest --port <port>` - Start as HTTP server