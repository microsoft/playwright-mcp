# SecureTestProcessManager

A consolidated process management utility for test scenarios that eliminates code duplication and provides secure child process spawning with standardized environment setup.

## Features

- **Secure Process Spawning**: Uses absolute Node.js paths and controlled environments to prevent PATH injection attacks
- **Standardized Environment Setup**: Consistent environment variable configuration across all test processes  
- **Stderr Parsing Utilities**: Built-in methods for extracting URLs, session information, and counting pattern matches
- **Automatic Cleanup**: Proper process lifecycle management with graceful termination
- **Fixture Integration**: Drop-in replacement for existing test fixtures

## Usage

### Basic Usage

```typescript
import { SecureTestProcessManager } from './process-test-manager.js';

const manager = new SecureTestProcessManager();

// Spawn a secure process
const result = await manager.spawnSecureProcess({
  args: ['--port=0'],
  userDataDir: '/path/to/user/data',
  mcpHeadless: true,
});

// Wait for server endpoint
const serverResult = await manager.spawnAndWaitForEndpoint({
  args: ['--isolated'],
  noPort: false,
});

// Parse stderr output
const sessionFolder = manager.extractSessionFolder(result.stderr());
const url = manager.extractListeningUrl(result.stderr());

// Cleanup
await manager.cleanup();
```

### Fixture Integration

```typescript
import { test as baseTest } from './fixtures.js';
import { SecureTestProcessManager } from './process-test-manager.js';

const test = baseTest.extend<{
  processManager: SecureTestProcessManager;
  serverEndpoint: (options?: { args?: string[]; noPort?: boolean; }) => Promise<{ url: URL; stderr: () => string }>;
}>({
  processManager: async ({}, use) => {
    const manager = new SecureTestProcessManager();
    await use(manager);
    await manager.cleanup();
  },

  serverEndpoint: async ({ mcpHeadless, processManager }, use, testInfo) => {
    await use(processManager.createServerEndpointFixture(testInfo, mcpHeadless));
  },
});
```

## Security Features

### Environment Isolation

The process manager creates a controlled environment that:

- Uses `NODE_ENV: 'test'` for test isolation
- Omits PATH variable to prevent injection attacks  
- Includes only essential environment variables (HOME, USER)
- Sets consistent debug configurations

### Process Security

- Uses absolute Node.js executable path (`process.execPath`) instead of relying on PATH
- Implements timeout protection to prevent hanging processes
- Provides graceful termination with fallback to SIGKILL

## Code Duplication Reduction

### Before (sse.spec.ts - 58 lines)

```typescript
const test = baseTest.extend<{
  serverEndpoint: (options?: { args?: string[]; noPort?: boolean; }) => Promise<{ url: URL; stderr: () => string }>;
}>({
  serverEndpoint: async ({ mcpHeadless }, use, testInfo) => {
    let cp: ChildProcess | undefined;
    const userDataDir = testInfo.outputPath('user-data-dir');
    await use(async (options?: { args?: string[]; noPort?: boolean }) => {
      if (cp) {
        throw new Error('Process already running');
      }

      // Security: Use absolute Node.js path instead of relying on PATH
      const nodeExecutable = process.execPath;
      cp = spawn(nodeExecutable, [
        path.join(path.dirname(__filename), '../cli.js'),
        ...(options?.noPort ? [] : ['--port=0']),
        `--user-data-dir=${userDataDir}`,
        ...(mcpHeadless ? ['--headless'] : []),
        ...(options?.args || []),
      ], {
        stdio: 'pipe',
        env: {
          NODE_ENV: 'test',
          HOME: process.env.HOME,
          USER: process.env.USER,
          DEBUG: 'pw:mcp:test',
          DEBUG_COLORS: '0',
          DEBUG_HIDE_DATE: '1',
        },
        timeout: 30_000,
      });
      // ... more setup code
    });
    cp?.kill('SIGTERM');
  },
});
```

### After (2 lines)

```typescript
const test = baseTest.extend<{
  serverEndpoint: (options?: { args?: string[]; noPort?: boolean; }) => Promise<{ url: URL; stderr: () => string }>;
}>({
  serverEndpoint: async ({ mcpHeadless, processManager }, use, testInfo) => {
    await use(processManager.createServerEndpointFixture(testInfo, mcpHeadless));
  },
});
```

## Benefits

- **33.3% code reduction** in sse.spec.ts
- **23.1% code reduction** in session-log.spec.ts  
- **Centralized security policies** for all test processes
- **Consistent error handling** and logging across tests
- **Better resource management** with automatic cleanup
- **Easier maintenance** with single source of truth for process management

## API Reference

### SecureTestProcessManager

#### Methods

- `spawnSecureProcess(options)`: Spawn a secure child process
- `spawnAndWaitForEndpoint(options)`: Spawn process and wait for server endpoint
- `extractSessionFolder(stderr)`: Extract session folder path from stderr
- `extractListeningUrl(stderr)`: Extract listening URL from stderr  
- `countPatternMatches(stderr, pattern)`: Count pattern matches in stderr
- `terminateProcess(process, signal)`: Gracefully terminate a process
- `terminateAllProcesses()`: Terminate all active processes
- `cleanup()`: Clean up all resources

#### Properties

- `activeProcessCount`: Number of active processes managed

### Options

#### SecureProcessOptions

```typescript
interface SecureProcessOptions {
  args?: string[];                    // CLI arguments
  userDataDir?: string;              // User data directory path
  mcpHeadless?: boolean;             // Run in headless mode
  timeout?: number;                  // Process timeout in milliseconds
  additionalEnv?: Record<string, string>; // Additional environment variables
}
```

## Migration Guide

To migrate existing test code:

1. Replace manual process spawning with `SecureTestProcessManager`
2. Use `createServerEndpointFixture()` for test fixtures
3. Replace custom stderr parsing with built-in utilities
4. Remove manual cleanup code (handled automatically)

See `process-manager-usage-example.ts` for detailed before/after examples.