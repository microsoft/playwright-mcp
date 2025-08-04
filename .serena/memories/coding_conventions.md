# Coding Conventions and Style

## Code Style
- **Language**: TypeScript with strict type checking
- **Module System**: ES modules (import/export)
- **File Extensions**: .ts for TypeScript files, .js for compiled output
- **Naming Conventions**:
  - Variables and functions: camelCase
  - Classes: PascalCase
  - Constants: UPPER_SNAKE_CASE
  - Files: camelCase or kebab-case

## Project Structure Patterns
- Tool implementations in `src/tools/` directory
- Each tool exports a schema and handler function
- Response handling centralized in `src/response.ts`
- Configuration management in `src/config.ts`
- MCP server logic in `src/mcp/` directory

## TypeScript Patterns
- Use Zod schemas for input validation
- Leverage TypeScript's type inference where possible
- Define interfaces for complex data structures
- Use generic types for reusable components

## Tool Implementation Pattern
```typescript
import { z } from 'zod';
import { defineTool } from './tool.js';

const toolSchema = z.object({
  // Define parameters
});

export const toolName = defineTool({
  capability: 'core', // or 'tabs', 'install', etc.
  schema: {
    name: 'tool_name',
    title: 'Tool Title',
    description: 'Tool description',
    inputSchema: toolSchema,
    type: 'readOnly' | 'destructive'
  },
  handle: async (context, params, response) => {
    // Implementation
  }
});
```

## Error Handling
- Use `response.addError()` for user-facing errors
- Throw exceptions for internal errors
- Validate inputs using Zod schemas
- Provide descriptive error messages

## Async/Await
- Use async/await for asynchronous operations
- Handle Promise rejections appropriately
- Use Promise.race() for timeout scenarios

## Documentation
- Use JSDoc comments for public APIs
- Include parameter descriptions in Zod schemas
- Maintain README.md with usage examples