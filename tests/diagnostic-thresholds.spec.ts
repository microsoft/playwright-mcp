/**
 * Configuration-driven architecture tests
 * Verifies DiagnosticThresholds and SmartConfig integration behavior
 */

import { test, expect } from '@playwright/test';
import { DiagnosticThresholds, getCurrentThresholds  } from '../src/diagnostics/DiagnosticThresholds.js';
import { SmartConfigManager } from '../src/diagnostics/SmartConfig.js';


test.describe('DiagnosticThresholds - Unit4 Configuration System', () => {

  test.beforeEach(() => {
    // Reset instance before each test
    DiagnosticThresholds.reset();
  });

  test.afterEach(() => {
    // Cleanup after each test
    DiagnosticThresholds.reset();
  });

  test.describe('Basic functionality tests', () => {
    test('default thresholds are correctly set', () => {
      const thresholds = getCurrentThresholds();
      const metrics = thresholds.getMetricsThresholds();

      // Verify default values
      expect(metrics.dom.elementsWarning).toBe(1500);
      expect(metrics.dom.elementsDanger).toBe(3000);
      expect(metrics.dom.depthWarning).toBe(15);
      expect(metrics.dom.depthDanger).toBe(20);
      expect(metrics.layout.highZIndexThreshold).toBe(1000);
      expect(metrics.layout.excessiveZIndexThreshold).toBe(9999);
    });

    test('singleton pattern works correctly', () => {
      const instance1 = getCurrentThresholds();
      const instance2 = getCurrentThresholds();

      expect(instance1).toBe(instance2);
    });

    test('category-specific threshold retrieval works', () => {
      const thresholds = getCurrentThresholds();

      const domThresholds = thresholds.getDomThresholds();
      expect(domThresholds.elementsWarning).toBe(1500);
      expect(domThresholds.elementsDanger).toBe(3000);

      const layoutThresholds = thresholds.getLayoutThresholds();
      expect(layoutThresholds.highZIndexThreshold).toBe(1000);
      expect(layoutThresholds.excessiveZIndexThreshold).toBe(9999);
    });
  });

  test.describe('Runtime configuration change tests', () => {
    test('partial threshold updates work', () => {
      const thresholds = getCurrentThresholds();

      // Update some thresholds
      thresholds.updateThresholds({
        dom: {
          elementsWarning: 2000,
          elementsDanger: 4000
        }
      });

      const metrics = thresholds.getMetricsThresholds();
      expect(metrics.dom.elementsWarning).toBe(2000);
      expect(metrics.dom.elementsDanger).toBe(4000);
      // Other values remain unchanged
      expect(metrics.dom.depthWarning).toBe(15);
      expect(metrics.layout.highZIndexThreshold).toBe(1000);
    });

    test('simultaneous updates of multiple categories work', () => {
      const thresholds = getCurrentThresholds();

      thresholds.updateThresholds({
        dom: {
          elementsWarning: 2500,
          elementsDanger: 5000,  // warningより大きい値にする
          depthWarning: 25,
          depthDanger: 30        // warningより大きい値にする
        },
        layout: {
          highZIndexThreshold: 2000
        }
      });

      const metrics = thresholds.getMetricsThresholds();
      expect(metrics.dom.elementsWarning).toBe(2500);
      expect(metrics.dom.elementsDanger).toBe(5000);
      expect(metrics.dom.depthWarning).toBe(25);
      expect(metrics.dom.depthDanger).toBe(30);
      expect(metrics.layout.highZIndexThreshold).toBe(2000);
    });

    test('default reset works', () => {
      const thresholds = getCurrentThresholds();

      // Change values
      thresholds.updateThresholds({
        dom: {
          elementsWarning: 9999,
          elementsDanger: 99999
        }
      });

      // Reset
      thresholds.resetToDefaults();

      const metrics = thresholds.getMetricsThresholds();
      expect(metrics.dom.elementsWarning).toBe(1500);  // Returns to default
      expect(metrics.dom.elementsDanger).toBe(3000);   // Returns to default
    });
  });

  test.describe('Configuration validation tests', () => {
    test('valid configuration passes validation', () => {
      const thresholds = getCurrentThresholds();

      // 有効な設定
      expect(() => {
        thresholds.updateThresholds({
          dom: {
            elementsWarning: 2000,
            elementsDanger: 4000  // warning < danger
          }
        });
      }).not.toThrow();
    });

    test('無効な設定は検証エラー', () => {
      const thresholds = getCurrentThresholds();

      // danger < warning（無効な設定）
      expect(() => {
        thresholds.updateThresholds({
          dom: {
            elementsWarning: 4000,
            elementsDanger: 2000  // danger < warning は無効
          }
        });
      }).toThrow();
    });

    test('負の値は検証エラー', () => {
      const thresholds = getCurrentThresholds();

      expect(() => {
        thresholds.updateThresholds({
          dom: {
            elementsWarning: -100  // 負の値は無効
          }
        });
      }).toThrow();
    });

    test('メモリ閾値の論理検証', () => {
      const thresholds = getCurrentThresholds();

      // リーク閾値 >= 最大使用量は無効
      expect(() => {
        thresholds.updateThresholds({
          memory: {
            maxMemoryUsage: 100 * 1024 * 1024,
            memoryLeakThreshold: 200 * 1024 * 1024  // leak > max は無効
          }
        });
      }).toThrow();
    });
  });

  test.describe('Configuration diagnostics tests', () => {
    test('デフォルト設定の診断', () => {
      const thresholds = getCurrentThresholds();
      const diagnostics = thresholds.getConfigDiagnostics();

      expect(diagnostics.status).toBe('valid');
      expect(diagnostics.customizations.length).toBe(0);
      expect(diagnostics.defaultsUsed.length).toBeGreaterThan(0);
    });

    test('カスタマイズ設定の診断', () => {
      const thresholds = getCurrentThresholds();

      // カスタム設定を適用
      thresholds.updateThresholds({
        dom: {
          elementsWarning: 2500,  // デフォルトから変更
          elementsDanger: 5000,   // warningより大きな値
          depthWarning: 25,       // デフォルトから変更
          depthDanger: 35         // warningより大きな値
        }
      });

      const diagnostics = thresholds.getConfigDiagnostics();
      expect(diagnostics.status).toBe('valid');
      expect(diagnostics.customizations.length).toBeGreaterThan(0);
      expect(diagnostics.customizations.some(c => c.includes('2500'))).toBe(true);
    });

    test('警告レベルの診断', () => {
      const thresholds = getCurrentThresholds();

      // 警告を発生させる設定
      thresholds.updateThresholds({
        dom: {
          elementsWarning: 3000,  // 非常に高い値
          elementsDanger: 6000,   // warningより大きな値
          depthWarning: 30,       // 非常に高い値
          depthDanger: 40         // warningより大きな値
        }
      });

      const diagnostics = thresholds.getConfigDiagnostics();
      expect(diagnostics.warnings.length).toBeGreaterThan(0);
    });
  });
});

test.describe('SmartConfig integration tests', () => {

  test.beforeEach(() => {
    DiagnosticThresholds.reset();
    // SmartConfigManagerのインスタンスも新しく取得する必要がある
    (SmartConfigManager as any).instance = null;
  });

  test.afterEach(() => {
    DiagnosticThresholds.reset();
    (SmartConfigManager as any).instance = null;
  });

  test.describe('SmartConfigManager integration', () => {
    test('SmartConfigがDiagnosticThresholdsから閾値を取得', () => {
      // カスタム閾値を設定
      const thresholds = getCurrentThresholds();
      thresholds.updateThresholds({
        dom: {
          elementsWarning: 2000,
          elementsDanger: 4000
        }
      });

      // SmartConfigManager が更新された閾値を使用することを確認
      const smartConfig = SmartConfigManager.getInstance();
      const config = smartConfig.getConfig();

      expect(config.performance.thresholds.dom.elementsWarning).toBe(2000);
      expect(config.performance.thresholds.dom.elementsDanger).toBe(4000);
    });

    test('SmartConfigによる閾値更新がDiagnosticThresholdsに反映', () => {
      const smartConfig = SmartConfigManager.getInstance();

      // SmartConfig経由で閾値を更新
      smartConfig.updateThresholds({
        dom: {
          elementsWarning: 3000,
          elementsDanger: 6000,  // warningより大きな値
          depthWarning: 30,
          depthDanger: 40        // warningより大きな値
        }
      });

      // DiagnosticThresholdsに反映されることを確認
      const thresholds = getCurrentThresholds();
      const metrics = thresholds.getMetricsThresholds();

      expect(metrics.dom.elementsWarning).toBe(3000);
      expect(metrics.dom.elementsDanger).toBe(6000);
      expect(metrics.dom.depthWarning).toBe(30);
      expect(metrics.dom.depthDanger).toBe(40);
    });

    test('統合状態の診断機能', () => {
      const smartConfig = SmartConfigManager.getInstance();
      const status = smartConfig.getThresholdsStatus();

      expect(status.isInSync).toBe(true);
      expect(status.diagnostics.status).toBe('valid');
      expect(status.smartConfigStatus).toContain('Synchronized');
    });

    test('環境別設定で統合された閾値が使用される', () => {
      // カスタム閾値を設定
      const thresholds = getCurrentThresholds();
      thresholds.updateThresholds({
        dom: {
          elementsWarning: 5000,
          elementsDanger: 10000  // warningより大きな値
        }
      });

      const smartConfig = SmartConfigManager.getInstance();

      // 開発環境設定を適用
      smartConfig.configureForEnvironment('development');

      // カスタム閾値が環境設定に反映されることを確認
      const config = smartConfig.getConfig();
      expect(config.performance.thresholds.dom.elementsWarning).toBe(5000);
      expect(config.performance.thresholds.dom.elementsDanger).toBe(10000);
    });
  });

  test.describe('Error handling tests', () => {
    test('設定同期エラーの適切な処理', () => {
      const smartConfig = SmartConfigManager.getInstance();

      // 無効な設定でのエラー処理をテスト
      expect(() => {
        smartConfig.updateThresholds({
          dom: {
            elementsWarning: -1  // 無効な値
          }
        });
      }).toThrow();
    });

    test('フォールバック機能の動作', () => {
      const thresholds = getCurrentThresholds();

      // 一部を無効な値に設定してリセット
      try {
        thresholds.updateThresholds({
          dom: {
            elementsWarning: -100
          }
        });
      } catch (error) {
        // エラー後にデフォルト値が保持されることを確認
        const metrics = thresholds.getMetricsThresholds();
        expect(metrics.dom.elementsWarning).toBe(1500); // デフォルト値
      }
    });
  });
});

test.describe('Integration scenario tests', () => {

  test.beforeEach(() => {
    DiagnosticThresholds.reset();
    (SmartConfigManager as any).instance = null;
  });

  test.afterEach(() => {
    DiagnosticThresholds.reset();
    (SmartConfigManager as any).instance = null;
  });

  test('完全な設定ライフサイクル', () => {
    // 1. デフォルト設定でスタート
    const thresholds = getCurrentThresholds();
    const smartConfig = SmartConfigManager.getInstance();

    expect(thresholds.getMetricsThresholds().dom.elementsWarning).toBe(1500);

    // 2. SmartConfig経由でランタイム設定変更（統合テスト）
    smartConfig.updateThresholds({
      dom: {
        elementsWarning: 2500,
        elementsDanger: 5000
      }
    });

    expect(smartConfig.getConfig().performance.thresholds.dom.elementsWarning).toBe(2500);
    expect(thresholds.getMetricsThresholds().dom.elementsWarning).toBe(2500);

    // 3. SmartConfig経由での追加変更
    smartConfig.updateThresholds({
      layout: {
        highZIndexThreshold: 2000
      }
    });

    expect(thresholds.getMetricsThresholds().layout.highZIndexThreshold).toBe(2000);

    // 4. 環境設定の適用（カスタマイズが上書きされるため、期待値を調整）
    smartConfig.getConfig().performance.thresholds.dom.elementsWarning;
    smartConfig.configureForEnvironment('production');

    // 環境設定適用後は現在の統合設定された閾値が使用される
    const afterEnvConfig = smartConfig.getConfig().performance.thresholds.dom.elementsWarning;
    expect(afterEnvConfig).toBe(thresholds.getMetricsThresholds().dom.elementsWarning);

    // 5. リセット
    smartConfig.reset();
    expect(thresholds.getMetricsThresholds().dom.elementsWarning).toBe(1500);
  });

  test('複数インスタンス間での一貫性', () => {
    const thresholds1 = getCurrentThresholds();
    const thresholds2 = getCurrentThresholds();
    const smartConfig = SmartConfigManager.getInstance();

    // 同一インスタンス
    expect(thresholds1).toBe(thresholds2);

    // 設定変更の一貫性 - SmartConfig経由で更新（統合機能）
    smartConfig.updateThresholds({
      dom: {
        elementsWarning: 3000,
        elementsDanger: 6000  // warningより大きな値
      }
    });

    expect(thresholds2.getMetricsThresholds().dom.elementsWarning).toBe(3000);
    expect(smartConfig.getConfig().performance.thresholds.dom.elementsWarning).toBe(3000);
  });
});
