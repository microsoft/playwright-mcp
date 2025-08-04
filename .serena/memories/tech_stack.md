# Tech Stack

## Runtime Requirements
- Node.js 18+

## Main Dependencies
- **Playwright**: 1.55.0-alpha-1753913825000 (browser automation framework)
- **@modelcontextprotocol/sdk**: ^1.16.0 (MCP SDK)
- **TypeScript**: ^5.8.2 (development language)
- **Commander**: ^13.1.0 (CLI framework)
- **Zod**: ^3.24.1 (schema validation)

## Development Environment
- **TypeScript Configuration**:
  - Target: ESNext
  - Module: NodeNext
  - Strict: true
  - esModuleInterop: true
  - Source directory: src
  - Output directory: lib

## Build System
- TypeScript compiler (tsc)
- ESModules ("type": "module" in package.json)