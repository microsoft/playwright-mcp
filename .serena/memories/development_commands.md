# Development Commands

## Essential Commands

### Build and Development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode compilation
- `npm run clean` - Remove compiled files from lib directory

### Code Quality
- `npm run lint` - Run ESLint and TypeScript checks + update README
- `npm run lint-fix` - Auto-fix ESLint issues
- `npm run update-readme` - Update README with tool documentation

### Testing
- `npm test` - Run all tests with Playwright
- `npm run ctest` - Run tests in Chrome only
- `npm run ftest` - Run tests in Firefox only
- `npm run wtest` - Run tests in WebKit only

### Server Operations
- `npm run run-server` - Start the MCP server manually
- `npx @playwright/mcp@latest` - Run the published version
- `npx @playwright/mcp@latest --help` - Show command line options

### Publishing
- `npm run npm-publish` - Full publish workflow (clean, build, test, publish)

## Configuration Options
The server accepts various command line arguments:
- `--browser <browser>` - Browser type (chrome, firefox, webkit, msedge)
- `--headless` - Run in headless mode
- `--port <port>` - Port for HTTP transport
- `--config <path>` - Configuration file path
- `--caps <caps>` - Additional capabilities (vision, pdf)
- `--isolated` - Keep browser profile in memory

## System Commands (macOS/Darwin)
- `git` - Version control
- `ls` - List directory contents
- `cd` - Change directory
- `grep` - Search text patterns
- `find` - Find files and directories
- `cat` - Display file contents
- `chmod` - Change file permissions
- `which` - Locate command

## Task Completion Workflow
1. Make code changes
2. Run `npm run lint` to check code quality
3. Run `npm test` to ensure tests pass
4. Run `npm run build` to compile
5. Test manually if needed with `npm run run-server`