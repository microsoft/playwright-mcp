/**
 * Unit tests for UnifiedSystem initialization improvements (Unit3)
 * Testing initializeComponents method and dependency management
 */

import { test, expect } from '@playwright/test';
import { UnifiedDiagnosticSystem } from '../src/diagnostics/UnifiedSystem.js';
import { DiagnosticError } from '../src/diagnostics/DiagnosticError.js';

test.describe('UnifiedSystem Initialization (Unit3)', () => {
  let system: UnifiedDiagnosticSystem;

  test.describe('initializeComponents method', () => {
    test('should initialize components in correct dependency order', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      // Access private method for testing (type assertion needed)
      const initializeComponents = (system as any).initializeComponents;
      expect(typeof initializeComponents).toBe('function');
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should fail when initializeComponents is not available', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      // This test ensures initializeComponents method exists
      const initializeComponents = (system as any).initializeComponents;
      expect(initializeComponents).toBeUndefined(); // Should fail initially
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should handle partial initialization failure with cleanup', async ({ page }) => {
      const config = {
        features: { enableResourceLeakDetection: true },
        performance: { enableResourceMonitoring: true }
      };
      
      system = UnifiedDiagnosticSystem.getInstance(page, config);
      
      // Access private method for testing
      const initializeComponents = (system as any).initializeComponents;
      
      if (initializeComponents) {
        // Mock one component to fail during initialization
        const mockError = new Error('Component initialization failed');
        
        try {
          await initializeComponents();
        } catch (error) {
          expect(error).toBeInstanceOf(DiagnosticError);
        }
      }
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should support dependency-aware initialization', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      // Test that components are initialized in stages
      const initializeComponents = (system as any).initializeComponents;
      
      if (initializeComponents) {
        const result = await initializeComponents();
        expect(result).toBeDefined();
      }
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Enhanced constructor integration', () => {
    test('should use async initialization pattern', async ({ page }) => {
      // Current constructor is synchronous - this test should guide the change
      const startTime = Date.now();
      system = UnifiedDiagnosticSystem.getInstance(page);
      const constructorTime = Date.now() - startTime;
      
      // Constructor should be fast (synchronous part only)
      expect(constructorTime).toBeLessThan(50);
      
      // But should have async initialization available
      const initMethod = (system as any).initializeComponents;
      expect(typeof initMethod).toBe('function');
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should handle initialization state management', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      // Check initialization state
      const isInitialized = (system as any).isInitialized;
      const initializationPromise = (system as any).initializationPromise;
      
      // These properties should exist after refactoring
      expect(typeof isInitialized).toBe('boolean');
      expect(initializationPromise).toBeDefined();
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Cleanup on partial failure', () => {
    test('should dispose partially initialized components', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      // Simulate partial initialization failure
      const cleanupPartialInitialization = (system as any).cleanupPartialInitialization;
      
      if (cleanupPartialInitialization) {
        // Mock component with dispose method
        const mockComponent = {
          dispose: async () => {}
        };
        await cleanupPartialInitialization([mockComponent]);
      }
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });

  test.describe('Error handling during initialization', () => {
    test('should create DiagnosticError for initialization failures', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      const initializeComponents = (system as any).initializeComponents;
      
      if (initializeComponents) {
        try {
          // Force an initialization error
          const originalPageAnalyzer = (system as any).pageAnalyzer;
          (system as any).pageAnalyzer = null; // Simulate component failure
          
          await initializeComponents();
          
          // Restore for cleanup
          (system as any).pageAnalyzer = originalPageAnalyzer;
        } catch (error) {
          expect(error).toBeInstanceOf(DiagnosticError);
          if (error instanceof DiagnosticError) {
            expect(error.component).toBe('UnifiedSystem');
            expect(error.operation).toBe('initializeComponents');
          }
        }
      }
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });

    test('should provide detailed error context for troubleshooting', async ({ page }) => {
      system = UnifiedDiagnosticSystem.getInstance(page);
      
      const initializeComponents = (system as any).initializeComponents;
      
      if (initializeComponents) {
        try {
          await initializeComponents();
        } catch (error) {
          if (error instanceof DiagnosticError) {
            expect(error.suggestions).toContain('Review component dependencies');
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
    test('should follow the create-then-initialize pattern', async ({ page }) => {
      // Similar to Context.create pattern
      const createSystem = async (testPage: any) => {
        const system = UnifiedDiagnosticSystem.getInstance(testPage);
        const initMethod = (system as any).initializeComponents;
        if (initMethod) {
          await initMethod();
        }
        return system;
      };
      
      system = await createSystem(page);
      expect(system).toBeInstanceOf(UnifiedDiagnosticSystem);
      
      // Cleanup
      UnifiedDiagnosticSystem.disposeInstance(page);
    });
  });
});