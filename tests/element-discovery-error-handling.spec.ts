/**
 * Test suite for ElementDiscovery error handling improvements
 * Testing Unit2 implementation: Enhanced dispose() error handling
 */

import { test, expect } from '@playwright/test';
import { ElementDiscovery } from '../src/diagnostics/ElementDiscovery.js';
import { DiagnosticError } from '../src/diagnostics/DiagnosticError.js';

test.describe('ElementDiscovery Error Handling', () => {
  let mockPage: any;
  let elementDiscovery: ElementDiscovery;

  test.beforeEach(() => {
    // Mock page with failing element dispose
    mockPage = {
      $$: async (selector: string) => {
        // Return mock elements that will fail during dispose
        return [
          {
            dispose: async () => {
              throw new Error('Element dispose failed - connection lost');
            },
            textContent: async () => 'test content',
            getAttribute: async (name: string) => name === 'value' ? 'test value' : null,
            evaluate: async (fn: Function) => 'test-selector'
          },
          {
            dispose: async () => {
              // This one succeeds
            },
            textContent: async () => 'test content 2',
            getAttribute: async (name: string) => null,
            evaluate: async (fn: Function) => 'test-selector-2'
          }
        ];
      }
    };

    elementDiscovery = new ElementDiscovery(mockPage);
  });

  test.afterEach(async () => {
    if (elementDiscovery)
      await elementDiscovery.dispose();

  });

  test('should handle dispose errors gracefully in findByText', async () => {
    // Test the critical path where dispose() fails
    const startTime = Date.now();

    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: '#test',
      searchCriteria: { text: 'test' },
      maxResults: 5
    });

    const executionTime = Date.now() - startTime;

    // Should continue processing despite dispose errors
    expect(alternatives.length).toBeGreaterThan(0);

    // Should not take excessive time due to dispose errors
    expect(executionTime).toBeLessThan(1000);
  });

  test('should properly wrap dispose errors in DiagnosticError', async () => {
    // Test the safeDispose method directly through a unit test approach
    const mockElement = {
      dispose: async () => {
        throw new Error('Element dispose failed - connection lost');
      }
    };

    // Track console.warn calls
    const originalWarn = console.warn;
    const warnCalls: any[] = [];
    // console.warn = (...args) => warnCalls.push(args);

    // Call safeDispose directly (accessing private method for testing)
    await (elementDiscovery as any).safeDispose(mockElement, 'test-operation');

    // Dispose errors should be logged as warnings with DiagnosticError context
    expect(warnCalls.some(call =>
      call[0].includes('[ElementDiscovery:dispose]')
    )).toBe(true);

    // console.warn = originalWarn;
  });

  test('should handle nested error scenarios correctly', async () => {
    // Mock page with multiple failure scenarios
    mockPage.$$ = async (selector: string) => {
      return [
        {
          dispose: async () => {
            throw new Error('Network connection lost');
          },
          textContent: async () => {
            throw new Error('Element detached from DOM');
          },
          getAttribute: async () => null,
          evaluate: async () => 'failed-selector'
        }
      ];
    };

    const originalWarn = console.warn;
    const warnCalls: any[] = [];
    // console.warn = (...args) => warnCalls.push(args);

    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: '#test',
      searchCriteria: { text: 'test' },
      maxResults: 1
    });

    // Should handle both element operation errors and dispose errors
    expect(alternatives.length).toBe(0); // No valid alternatives due to errors
    expect(warnCalls.length).toBeGreaterThan(0); // Errors should be logged

    // console.warn = originalWarn;
  });

  test('should maintain resource cleanup guarantees', async () => {
    let disposeCallCount = 0;

    const mockElement = {
      dispose: async () => {
        disposeCallCount++;
        throw new Error('Dispose fails every time');
      }
    };

    const originalWarn = console.warn;
    const warnCalls: any[] = [];
    // console.warn = (...args) => warnCalls.push(args);

    // Test multiple calls to safeDispose
    await (elementDiscovery as any).safeDispose(mockElement, 'cleanup-test-1');
    await (elementDiscovery as any).safeDispose(mockElement, 'cleanup-test-2');

    // Should attempt dispose even if it fails
    expect(disposeCallCount).toBeGreaterThan(0);

    // Should log dispose failures appropriately
    expect(warnCalls.some(call =>
      call[0].includes('dispose')
    )).toBe(true);

    // console.warn = originalWarn;
  });

  test('should create properly structured DiagnosticError for dispose failures', async () => {
    const originalError = new Error('Element handle is invalid');

    const diagnosticError = DiagnosticError.from(
        originalError,
        'ElementDiscovery',
        'dispose',
        {
          performanceImpact: 'medium',
          suggestions: [
            'Ensure elements are valid before disposal',
            'Implement retry logic for dispose operations'
          ]
        }
    );

    expect(diagnosticError.component).toBe('ElementDiscovery');
    expect(diagnosticError.operation).toBe('dispose');
    expect(diagnosticError.originalError).toBe(originalError);
    expect(diagnosticError.performanceImpact).toBe('medium');
    expect(diagnosticError.suggestions).toContain('Ensure elements are valid before disposal');
  });

  test('should handle memory pressure scenarios during dispose', async () => {
    let memoryUsage = 80 * 1024 * 1024; // Start at 80MB (near limit)

    const mockElement = {
      dispose: async () => {
        memoryUsage += 30 * 1024 * 1024; // Exceed limit by 30MB
        throw DiagnosticError.resource(
            'Memory limit exceeded during dispose',
            'ElementDiscovery',
            'dispose',
            memoryUsage,
            100 * 1024 * 1024 // 100MB limit
        );
      }
    };

    const originalWarn = console.warn;
    const warnCalls: any[] = [];
    // console.warn = (...args) => warnCalls.push(args);

    // Test memory pressure scenario with safeDispose
    await (elementDiscovery as any).safeDispose(mockElement, 'memory-pressure-test');

    // Should log resource-related warnings
    expect(warnCalls.some(call =>
      call[0].includes('dispose')
    )).toBe(true);

    // console.warn = originalWarn;
  });
});
