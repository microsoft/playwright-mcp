/**
 * Tests for diagnostic level control functionality
 */

import { test, expect } from '@playwright/test';
import { DiagnosticLevel, DiagnosticLevelManager  } from '../src/diagnostics/DiagnosticLevel.js';
import type { DiagnosticConfig } from '../src/diagnostics/DiagnosticLevel.js';

test.describe('DiagnosticLevelManager', () => {
  test.describe('Feature enablement based on level', () => {
    test('should disable all features for NONE level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.NONE });

      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(false);
      expect(manager.shouldEnableFeature('pageAnalysis')).toBe(false);
      expect(manager.shouldEnableFeature('performanceTracking')).toBe(false);
      expect(manager.shouldEnableFeature('iframeDetection')).toBe(false);
      expect(manager.shouldEnableFeature('modalDetection')).toBe(false);
      expect(manager.shouldEnableFeature('accessibilityAnalysis')).toBe(false);
      expect(manager.shouldSkipDiagnostics()).toBe(true);
    });

    test('should enable only critical features for BASIC level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.BASIC });

      expect(manager.shouldEnableFeature('iframeDetection')).toBe(true);
      expect(manager.shouldEnableFeature('modalDetection')).toBe(true);
      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(false);
      expect(manager.shouldEnableFeature('pageAnalysis')).toBe(false);
      expect(manager.shouldEnableFeature('performanceTracking')).toBe(false);
      expect(manager.shouldEnableFeature('accessibilityAnalysis')).toBe(false);
    });

    test('should enable standard features for STANDARD level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.STANDARD });

      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(true);
      expect(manager.shouldEnableFeature('pageAnalysis')).toBe(true);
      expect(manager.shouldEnableFeature('iframeDetection')).toBe(true);
      expect(manager.shouldEnableFeature('modalDetection')).toBe(true);
      expect(manager.shouldEnableFeature('performanceTracking')).toBe(false);
      expect(manager.shouldEnableFeature('accessibilityAnalysis')).toBe(false);
    });

    test('should enable detailed features for DETAILED level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.DETAILED });

      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(true);
      expect(manager.shouldEnableFeature('pageAnalysis')).toBe(true);
      expect(manager.shouldEnableFeature('performanceTracking')).toBe(true);
      expect(manager.shouldEnableFeature('iframeDetection')).toBe(true);
      expect(manager.shouldEnableFeature('modalDetection')).toBe(true);
      expect(manager.shouldEnableFeature('accessibilityAnalysis')).toBe(false);
    });

    test('should enable all features for FULL level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.FULL });

      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(true);
      expect(manager.shouldEnableFeature('pageAnalysis')).toBe(true);
      expect(manager.shouldEnableFeature('performanceTracking')).toBe(true);
      expect(manager.shouldEnableFeature('iframeDetection')).toBe(true);
      expect(manager.shouldEnableFeature('modalDetection')).toBe(true);
      expect(manager.shouldEnableFeature('accessibilityAnalysis')).toBe(true);
    });
  });

  test.describe('Feature toggle overrides', () => {
    test('should respect explicit feature toggles over level defaults', () => {
      const manager = new DiagnosticLevelManager({
        level: DiagnosticLevel.BASIC,
        features: {
          alternativeSuggestions: true,  // Override to enable
          iframeDetection: false          // Override to disable
        }
      });

      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(true);
      expect(manager.shouldEnableFeature('iframeDetection')).toBe(false);
    });

    test('should allow disabling features in FULL level', () => {
      const manager = new DiagnosticLevelManager({
        level: DiagnosticLevel.FULL,
        features: {
          performanceTracking: false
        }
      });

      expect(manager.shouldEnableFeature('performanceTracking')).toBe(false);
      expect(manager.shouldEnableFeature('accessibilityAnalysis')).toBe(true);
    });
  });

  test.describe('Max alternatives configuration', () => {
    test('should return 0 alternatives for NONE level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.NONE });
      expect(manager.getMaxAlternatives()).toBe(0);
    });

    test('should return 1 alternative for BASIC level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.BASIC });
      expect(manager.getMaxAlternatives()).toBe(1);
    });

    test('should return default 5 alternatives for STANDARD level', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.STANDARD });
      expect(manager.getMaxAlternatives()).toBe(5);
    });

    test('should return 10 alternatives for DETAILED and FULL levels', () => {
      const managerDetailed = new DiagnosticLevelManager({ level: DiagnosticLevel.DETAILED });
      const managerFull = new DiagnosticLevelManager({ level: DiagnosticLevel.FULL });

      expect(managerDetailed.getMaxAlternatives()).toBe(10);
      expect(managerFull.getMaxAlternatives()).toBe(10);
    });

    test('should respect custom threshold override', () => {
      const manager = new DiagnosticLevelManager({
        level: DiagnosticLevel.STANDARD,
        thresholds: {
          maxAlternatives: 3
        }
      });

      expect(manager.getMaxAlternatives()).toBe(3);
    });
  });

  test.describe('Performance thresholds', () => {
    test('should use default 300ms threshold', () => {
      const manager = new DiagnosticLevelManager();
      expect(manager.getMaxDiagnosticTime()).toBe(300);
    });

    test('should respect custom diagnostic time threshold', () => {
      const manager = new DiagnosticLevelManager({
        thresholds: {
          maxDiagnosticTime: 500
        }
      });

      expect(manager.getMaxDiagnosticTime()).toBe(500);
    });
  });

  test.describe('Runtime configuration updates', () => {
    test('should allow updating configuration at runtime', () => {
      const manager = new DiagnosticLevelManager({ level: DiagnosticLevel.BASIC });

      expect(manager.shouldEnableFeature('performanceTracking')).toBe(false);

      manager.updateConfig({ level: DiagnosticLevel.DETAILED });

      expect(manager.shouldEnableFeature('performanceTracking')).toBe(true);
    });

    test('should merge configuration updates properly', () => {
      const manager = new DiagnosticLevelManager({
        level: DiagnosticLevel.STANDARD,
        thresholds: {
          maxAlternatives: 5
        }
      });

      manager.updateConfig({
        features: {
          performanceTracking: true
        }
      });

      const config = manager.getConfig();
      expect(config.level).toBe(DiagnosticLevel.STANDARD);
      expect(config.features?.performanceTracking).toBe(true);
      expect(config.thresholds?.maxAlternatives).toBe(5);
    });
  });

  test.describe('Default configuration', () => {
    test('should use STANDARD level by default', () => {
      const manager = new DiagnosticLevelManager();
      const config = manager.getConfig();

      expect(config.level).toBe(DiagnosticLevel.STANDARD);
      expect(manager.shouldSkipDiagnostics()).toBe(false);
    });

    test('should have sensible feature defaults', () => {
      const manager = new DiagnosticLevelManager();

      expect(manager.shouldEnableFeature('alternativeSuggestions')).toBe(true);
      expect(manager.shouldEnableFeature('pageAnalysis')).toBe(true);
      expect(manager.shouldEnableFeature('performanceTracking')).toBe(false);
    });
  });
});
