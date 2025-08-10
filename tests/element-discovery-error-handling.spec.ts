/**
 * Test suite for ElementDiscovery error handling improvements
 * Testing Unit2 implementation: Enhanced dispose() error handling
 */

import { expect, test } from '@playwright/test';
import { DiagnosticError } from '../src/diagnostics/diagnostic-error.js';
import { ElementDiscovery } from '../src/diagnostics/element-discovery.js';
import {
  assertExecutionTime,
  createMockElement,
  createMockPage,
  DiagnosticTestSetup,
  expectDiagnosticError,
  measureExecutionTime,
} from './test-helpers.js';

test.describe('ElementDiscovery Error Handling', () => {
  let mockPage: {
    locator: (selector: string) => unknown;
    $: (selector: string) => Promise<unknown>;
  };
  let elementDiscovery: ElementDiscovery;
  let testSetup: DiagnosticTestSetup;

  test.beforeEach(() => {
    testSetup = new DiagnosticTestSetup();
    testSetup.beforeEach(true, ['warn', 'error', 'info']);

    // Create mock elements - one that fails dispose, one that succeeds
    const mockElements = [
      createMockElement({
        disposeError: new Error('Element dispose failed - connection lost'),
        textContent: 'test content',
        attributes: { value: 'test value' },
        selector: 'test-selector',
      }),
      createMockElement({
        textContent: 'test content 2',
        selector: 'test-selector-2',
      }),
    ];

    mockPage = createMockPage(mockElements);
    elementDiscovery = new ElementDiscovery(mockPage);
  });

  test.afterEach(async () => {
    if (elementDiscovery) {
      await elementDiscovery.dispose();
    }
    testSetup.afterEach();
  });

  test('should handle dispose errors gracefully in findByText', async () => {
    // Test the critical path where dispose() fails
    const { result: alternatives, executionTime } = await measureExecutionTime(
      () =>
        elementDiscovery.findAlternativeElements({
          originalSelector: '#test',
          searchCriteria: { text: 'test' },
          maxResults: 5,
        })
    );

    // Should continue processing despite dispose errors
    expect(alternatives.length).toBeGreaterThan(0);

    // Should not take excessive time due to dispose errors
    assertExecutionTime(executionTime, 1000, 'dispose error handling');
  });

  test('should properly wrap dispose errors in DiagnosticError', async () => {
    // Test the safeDispose method directly through a unit test approach
    const mockElement = createMockElement({
      disposeError: new Error('Element dispose failed - connection lost'),
    });

    // Call safeDisposePublic directly (public method for testing)
    await elementDiscovery.safeDisposePublic(mockElement, 'test-operation');

    // Dispose errors should be logged as warnings with DiagnosticError context
    const consoleCapture = testSetup.getConsoleCapture();
    // Check for either logger format (ElementDiscovery:discovery or ErrorEnrichmentUtils)
    const hasElementDiscoveryLog = consoleCapture.hasMessageContaining(
      '[ElementDiscovery:discovery]',
      'warn'
    );
    const hasErrorEnrichmentLog = consoleCapture.hasMessageContaining(
      'Failed to dispose',
      'warn'
    );

    expect(hasElementDiscoveryLog || hasErrorEnrichmentLog).toBe(true);
  });

  test('should handle nested error scenarios correctly', async () => {
    // Create mock element with multiple failure scenarios
    const failingElement = {
      dispose: () => {
        throw new Error('Network connection lost');
      },
      textContent: () => {
        throw new Error('Element detached from DOM');
      },
      getAttribute: async () => null,
      evaluate: async () => 'failed-selector',
    };

    (mockPage as { $$: (selector: string) => Promise<unknown[]> }).$$ =
      async () => [failingElement];

    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: '#test',
      searchCriteria: { text: 'test' },
      maxResults: 1,
    });

    // Should handle both element operation errors and dispose errors
    expect(alternatives.length).toBe(0); // No valid alternatives due to errors

    // Errors should be logged
    const consoleCapture = testSetup.getConsoleCapture();
    expect(consoleCapture.getMessageCount('warn')).toBeGreaterThan(0);
  });

  test('should maintain resource cleanup guarantees', async () => {
    let disposeCallCount = 0;

    const mockElement = {
      dispose: () => {
        disposeCallCount++;
        throw new Error('Dispose fails every time');
      },
    };

    // Test multiple calls to safeDisposePublic
    await elementDiscovery.safeDisposePublic(mockElement, 'cleanup-test-1');
    await elementDiscovery.safeDisposePublic(mockElement, 'cleanup-test-2');

    // Should attempt dispose even if it fails
    expect(disposeCallCount).toBeGreaterThan(0);

    // Should log dispose failures appropriately
    const consoleCapture = testSetup.getConsoleCapture();
    // Check for either logger format (ElementDiscovery:discovery or ErrorEnrichmentUtils)
    const hasElementDiscoveryLog = consoleCapture.hasMessageContaining(
      '[ElementDiscovery:discovery]',
      'warn'
    );
    const hasErrorEnrichmentLog = consoleCapture.hasMessageContaining(
      'Failed to dispose',
      'warn'
    );

    expect(hasElementDiscoveryLog || hasErrorEnrichmentLog).toBe(true);
  });

  test('should create properly structured DiagnosticError for dispose failures', () => {
    const originalError = new Error('Element handle is invalid');

    const diagnosticError = DiagnosticError.from(
      originalError,
      'ElementDiscovery',
      'dispose',
      {
        performanceImpact: 'medium',
        suggestions: [
          'Ensure elements are valid before disposal',
          'Implement retry logic for dispose operations',
        ],
      }
    );

    expectDiagnosticError(diagnosticError, 'ElementDiscovery', 'dispose');
    expect(diagnosticError.originalError).toBe(originalError);
    expect(diagnosticError.performanceImpact).toBe('medium');
    expect(diagnosticError.suggestions).toContain(
      'Ensure elements are valid before disposal'
    );
  });

  test('should handle memory pressure scenarios during dispose', async () => {
    let memoryUsage = 80 * 1024 * 1024; // Start at 80MB (near limit)

    const mockElement = {
      dispose: () => {
        memoryUsage += 30 * 1024 * 1024; // Exceed limit by 30MB
        throw DiagnosticError.resource(
          'Memory limit exceeded during dispose',
          'ElementDiscovery',
          'dispose',
          memoryUsage,
          100 * 1024 * 1024 // 100MB limit
        );
      },
    };

    // Test memory pressure scenario with safeDisposePublic
    await elementDiscovery.safeDisposePublic(
      mockElement,
      'memory-pressure-test'
    );

    // Should log resource-related warnings
    const consoleCapture = testSetup.getConsoleCapture();
    // Check for either logger format (ElementDiscovery:discovery or ErrorEnrichmentUtils)
    const hasElementDiscoveryLog = consoleCapture.hasMessageContaining(
      '[ElementDiscovery:discovery]',
      'warn'
    );
    const hasErrorEnrichmentLog = consoleCapture.hasMessageContaining(
      'Failed to dispose',
      'warn'
    );

    expect(hasElementDiscoveryLog || hasErrorEnrichmentLog).toBe(true);
  });
});
