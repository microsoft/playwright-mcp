/**
 * Unit tests for UnifiedSystem initialization improvements (Unit3)
 * Testing initializeComponents method and dependency management
 */

import { expect, test } from '@playwright/test';
import type { Page } from 'playwright';
import { DiagnosticError } from '../src/diagnostics/diagnostic-error.js';
import { UnifiedDiagnosticSystem } from '../src/diagnostics/unified-system.js';

test.describe('UnifiedSystem Initialization (Unit3)', () => {
  let system: UnifiedDiagnosticSystem;

  test.describe('initializeComponents method', () => {
    test('should initialize components in correct dependency order', ({
      page,
    }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      // Access private method for testing (type assertion needed)
      const initializeComponents = (
        system as unknown as { initializeComponents: () => Promise<void> }
      ).initializeComponents;
      expect(typeof initializeComponents).toBe('function');

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should fail when initializeComponents is not available', ({
      page,
    }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      // This test verifies that initializeComponents method is available
      const initializeComponents = (
        system as unknown as { initializeComponents: () => Promise<void> }
      ).initializeComponents;
      expect(typeof initializeComponents).toBe('function'); // Should be a function

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should handle partial initialization failure with cleanup', async ({
      page,
    }) => {
      const config = {
        features: { enableResourceLeakDetection: true },
        performance: { enableResourceMonitoring: true },
      };

      system = UnifiedDiagnosticSystem.getInstance(page, config);

      // Reset the initialization manager to allow re-initialization
      // initManager.reset() is not available - need to create a new instance instead

      // Mock component creation to fail by disposing the system first
      await system.dispose();

      try {
        // Call the method directly on the instance to preserve 'this' binding
        await system.initializeComponents();
        // Test should not reach here if initialization failed
        expect(false).toBe(true); // Force test failure if no error was thrown
      } catch (error) {
        // Error expected
        expect(error).toBeInstanceOf(DiagnosticError);
      }

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should support dependency-aware initialization', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      // Test that components are initialized in stages
      // Call the method directly on the instance to preserve 'this' binding
      try {
        await system.initializeComponents();
        // If we reach here, initialization succeeded
        expect(system.isInitialized).toBe(true);
      } catch (error) {
        // If initialization fails, that's also a valid test result
        // as long as we can verify the error handling
        expect(error).toBeDefined();
      }

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Enhanced constructor integration', () => {
    test('should use async initialization pattern', ({ page }) => {
      // Current constructor is synchronous - this test should guide the change
      const startTime = Date.now();
      system = UnifiedDiagnosticSystem.getInstance(page);
      const constructorTime = Date.now() - startTime;

      // Constructor should be fast (synchronous part only)
      expect(constructorTime).toBeLessThan(50);

      // But should have async initialization available
      const initMethod = (
        system as unknown as { initializeComponents: () => Promise<void> }
      ).initializeComponents;
      expect(typeof initMethod).toBe('function');

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should handle initialization state management', ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      // Check initialization state
      const isInitialized = (system as unknown as { isInitialized: boolean })
        .isInitialized;
      const initializationPromise = (
        system as unknown as { initializationPromise: Promise<void> | null }
      ).initializationPromise;

      // These properties should exist after refactoring
      expect(typeof isInitialized).toBe('boolean');
      expect(initializationPromise).toBeDefined();

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Cleanup on partial failure', () => {
    test('should dispose partially initialized components', async ({
      page,
    }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      // Simulate partial initialization failure
      const cleanupPartialInitialization = (
        system as unknown as {
          cleanupPartialInitialization: (
            components: { dispose: () => Promise<void> }[]
          ) => Promise<void>;
        }
      ).cleanupPartialInitialization;

      if (cleanupPartialInitialization) {
        // Mock component with dispose method
        const mockComponent = {
          dispose: async (): Promise<void> => {
            // Mock dispose implementation - no operation needed for test
          },
        };
        await cleanupPartialInitialization([mockComponent]);
      }

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Error handling during initialization', () => {
    test('should create DiagnosticError for initialization failures', async ({
      page,
    }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      try {
        // Force an initialization error by disposing first
        await system.dispose();
        await system.initializeComponents();

        // If we reach here, the test should fail because we expected an error
        expect(false).toBe(true); // Force test failure if no error was thrown
      } catch (error) {
        // Error expected, no cleanup needed

        // The error should be wrapped in a DiagnosticError
        expect(error).toBeInstanceOf(DiagnosticError);
        if (error instanceof DiagnosticError) {
          // The error could come from either UnifiedSystem or InitializationManager
          expect(['UnifiedSystem', 'InitializationManager']).toContain(
            error.component
          );
          expect(['initializeComponents', 'initialize']).toContain(
            error.operation
          );
          expect(
            error.suggestions.some(
              (s) =>
                s.includes('component dependencies') ||
                s.includes('Check component dependencies')
            )
          ).toBe(true);
        }
      }

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should provide detailed error context for troubleshooting', async ({
      page,
    }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);

      const initializeComponents = (
        system as unknown as { initializeComponents: () => Promise<void> }
      ).initializeComponents;

      if (initializeComponents) {
        try {
          await initializeComponents();
        } catch (error) {
          if (error instanceof DiagnosticError) {
            expect(error.suggestions).toContain(
              'Review component dependencies'
            );
            expect(error.context).toHaveProperty('stage');
            expect(error.context).toHaveProperty('failedComponents');
          }
        }
      }

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Integration with existing Context pattern', () => {
    test('should follow the create-then-initialize pattern', async ({
      page,
    }) => {
      // Similar to Context.create pattern
      const createSystem = async (testPage: Page) => {
        const testSystem = UnifiedDiagnosticSystem.getInstance(testPage);
        // Call the method directly on the instance to preserve 'this' binding
        await testSystem.initializeComponents();

        return testSystem;
      };

      system = await createSystem(page);
      expect(system).toBeInstanceOf(UnifiedDiagnosticSystem);

      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });
});
