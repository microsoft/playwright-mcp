# MCP Benchmark Suite

A comprehensive benchmarking tool for comparing MCP (Model Context Protocol) server performance between the original Playwright MCP implementation and the fast-playwright-mcp optimization.

## Features

- **Modular Architecture**: Clean separation of concerns with dedicated classes for server management, benchmark execution, and reporting
- **TypeScript Support**: Full type safety and modern development experience
- **Configurable**: Externalized configuration for timeouts, retries, and output settings
- **Robust Error Handling**: Comprehensive error handling with retry logic and graceful fallbacks
- **Detailed Reporting**: Multiple output formats including summary statistics and detailed analysis
- **Flexible Scenarios**: Easy-to-define benchmark scenarios with server-specific optimizations

## Architecture

### Core Components

- **`MCPBenchmark`**: Main orchestrator class that coordinates the entire benchmarking process
- **`MCPServerManager`**: Handles MCP server lifecycle (start, initialize, shutdown)
- **`BenchmarkEngine`**: Executes benchmark scenarios with retry logic and server switching
- **`Reporter`**: Generates reports and analyzes performance comparisons
- **`utils.ts`**: Utility functions for process management, validation, and result processing

### Configuration System

- **`config.ts`**: Centralized configuration with sensible defaults
- **`types.ts`**: Comprehensive type definitions for type safety
- **`scenarios.ts`**: Predefined benchmark scenarios

## Usage

### Basic Usage

```bash
# Run benchmark with default settings
npm run benchmark

# Run with verbose output and detailed analysis
npm run benchmark:verbose

# Run with minimal output
npm run benchmark:quiet
```

### Direct Node.js Execution

```bash
# Build and run
npm run build:benchmark
node benchmark/lib/index.js

# With options
node benchmark/lib/index.js --verbose
node benchmark/lib/index.js --quiet
```

### Programmatic Usage

```typescript
import { MCPBenchmark, BENCHMARK_SCENARIOS } from './benchmark/index.js';

const benchmark = new MCPBenchmark({
  logging: { verbose: true },
  timeouts: { toolCall: 30000 }
});

await benchmark.run(BENCHMARK_SCENARIOS);
console.log('Results:', benchmark.getResults());
```

## Configuration

### Default Configuration

```typescript
{
  servers: {
    original: {
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest', '--isolated']
    },
    fast: {
      command: 'node',
      args: ['cli.js', '--isolated']
    }
  },
  timeouts: {
    initialization: 5000,
    toolCall: 20000,
    screenshotCall: 30000,
    serverSwitch: 3000,
    processCleanup: 2000
  },
  retries: {
    maxRetries: 2,
    retryDelay: 2000
  },
  output: {
    resultsDirectory: 'benchmark',
    filePrefix: 'stable-results'
  },
  logging: {
    verbose: false,
    includeStepDetails: true
  }
}
```

### Custom Configuration

```typescript
const customConfig = {
  timeouts: {
    toolCall: 30000,  // Longer timeout for slow operations
    screenshotCall: 45000
  },
  logging: {
    verbose: true,    // Enable detailed analysis
    includeStepDetails: true
  }
};

const benchmark = new MCPBenchmark(customConfig);
```

## Benchmark Scenarios

### Built-in Scenarios

1. **Baseline Comparison**: Default behavior without optimization
2. **Code Suppression**: Navigation without showing Playwright code
3. **Minimal Response**: Only show operation result
4. **Snapshot Size Optimization**: Limited snapshot with size constraints
5. **Screenshot Optimization**: Screenshot with image compression

### Custom Scenarios

```typescript
import { BenchmarkScenario } from './benchmark/types.js';

const customScenario: BenchmarkScenario = {
  name: "Custom Test",
  description: "My custom benchmark scenario",
  steps: [
    { 
      tool: "browser_navigate", 
      args: { url: "https://example.com" },
      fastArgs: { 
        url: "https://example.com",
        expectation: { includeCode: false }
      }
    }
  ]
};
```

## Output and Reporting

### Console Output

The benchmark provides detailed console output including:

- Real-time progress updates
- Step-by-step execution details
- Comparison results with percentage improvements
- Summary statistics
- Success rates

### File Output

Results are automatically saved to JSON files:

```
benchmark/stable-results-2024-01-01T12-00-00-000Z.json
```

### Sample Output

```
📊 COMPARISON RESULTS
=====================

📋 Code Suppression
   Navigation without showing Playwright code
   📊 Results:
      Size: 15420 → 8930 bytes (42.1% reduction)
      Tokens: ~3855 → ~2232 (42.1% reduction)

📊 SUMMARY
==========
Valid comparisons: 4
Average size reduction: 38.7%
Average token reduction: 35.2%
Total size: 45230 → 27650 bytes
Total tokens: 11307 → 6912

✅ Benchmark completed successfully
🎉 Average improvements: 38.7% size, 35.2% tokens
```

## Development

### Building

```bash
# Build everything
npm run build

# Build only benchmark
npm run build:benchmark
```

### Linting

```bash
# Lint with type checking
npm run lint

# Auto-fix issues
npm run lint-fix
```

### Project Structure

```
benchmark/
├── config.ts              # Configuration and constants
├── types.ts               # Type definitions
├── scenarios.ts           # Predefined scenarios
├── utils.ts               # Utility functions
├── MCPServerManager.ts    # Server lifecycle management
├── BenchmarkEngine.ts     # Benchmark execution engine
├── Reporter.ts            # Results reporting and analysis
├── MCPBenchmark.ts        # Main orchestrator class
├── index.ts               # CLI entry point
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Error Handling

The benchmark system includes comprehensive error handling:

- **Retry Logic**: Automatic retries with exponential backoff
- **Alternative URLs**: Fallback URLs for navigation failures
- **Graceful Degradation**: Continues running even if individual steps fail
- **Process Cleanup**: Ensures proper cleanup of server processes
- **Detailed Error Reporting**: Clear error messages with context

## Performance Considerations

- **Server Isolation**: Each server runs in isolation to prevent interference
- **Resource Cleanup**: Automatic cleanup of processes and resources
- **Configurable Timeouts**: Adjustable timeouts for different operation types
- **Memory Management**: Efficient handling of large responses and images

## Troubleshooting

### Common Issues

1. **Server startup failures**: Check that the required dependencies are installed
2. **Timeout errors**: Increase timeout values in configuration
3. **Port conflicts**: Ensure no other processes are using the required ports
4. **Permission errors**: Check file system permissions for output directory

### Debug Mode

```bash
# Enable verbose logging for debugging
node benchmark/lib/index.js --verbose
```

### Manual Cleanup

```bash
# Kill any stuck processes
pkill -f "cli.js --isolated"
pkill -f "@playwright/mcp.*--isolated"
```

## Contributing

When adding new features:

1. Follow the existing architectural patterns
2. Add appropriate type definitions
3. Include error handling and logging
4. Update documentation
5. Add tests for new functionality

## License

This project follows the same license as the parent fast-playwright-mcp project.