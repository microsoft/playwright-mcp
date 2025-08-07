/**
 * DiagnosticThresholds - 診断システムの閾値管理クラス
 * すべてのハードコーディングされた閾値を中央集約化
 */
/**
 * デフォルト閾値設定
 * すべてのハードコーディング値をここに集約
 */
const DEFAULT_THRESHOLDS = {
    executionTime: {
        pageAnalysis: 1000,
        elementDiscovery: 500,
        resourceMonitoring: 200,
        parallelAnalysis: 2000
    },
    memory: {
        maxMemoryUsage: 100 * 1024 * 1024,
        memoryLeakThreshold: 50 * 1024 * 1024,
        gcTriggerThreshold: 80 * 1024 * 1024
    },
    performance: {
        domElementLimit: 10000,
        maxDepthLimit: 50,
        largeSubtreeThreshold: 1000
    },
    dom: {
        totalElements: 10000,
        maxDepth: 50,
        largeSubtrees: 10,
        elementsWarning: 1500,
        elementsDanger: 3000,
        depthWarning: 15,
        depthDanger: 20,
        largeSubtreeThreshold: 500
    },
    interaction: {
        clickableElements: 100,
        formElements: 50,
        clickableHigh: 100
    },
    layout: {
        fixedElements: 10,
        highZIndexElements: 5,
        highZIndexThreshold: 1000,
        excessiveZIndexThreshold: 9999
    }
};
/**
 * 診断システムの閾値管理（シングルトン）
 * 設定の検証、デフォルト値フォールバック、ランタイム設定変更をサポート
 */
export class DiagnosticThresholds {
    static instance = null;
    currentThresholds;
    constructor(initialConfig) {
        this.currentThresholds = this.mergeWithDefaults(initialConfig || {});
        this.validateThresholds(this.currentThresholds);
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(config) {
        if (!DiagnosticThresholds.instance) {
            DiagnosticThresholds.instance = new DiagnosticThresholds(config);
        }
        else if (config) {
            // 既存インスタンスに設定を更新
            DiagnosticThresholds.instance.updateThresholds(config);
        }
        return DiagnosticThresholds.instance;
    }
    /**
     * インスタンスをリセット（テスト用）
     */
    static reset() {
        DiagnosticThresholds.instance = null;
    }
    /**
     * 現在の閾値設定をMetricsThresholds形式で取得
     */
    getMetricsThresholds() {
        // @ts-ignore - Type-safe conversion ensuring all properties are defined (guaranteed by mergeWithDefaults)
        const thresholds = this.currentThresholds;
        return {
            executionTime: {
                // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
                pageAnalysis: thresholds.executionTime.pageAnalysis,
                // @ts-ignore
                elementDiscovery: thresholds.executionTime.elementDiscovery,
                // @ts-ignore
                resourceMonitoring: thresholds.executionTime.resourceMonitoring,
                // @ts-ignore
                parallelAnalysis: thresholds.executionTime.parallelAnalysis
            },
            memory: {
                // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
                maxMemoryUsage: thresholds.memory.maxMemoryUsage,
                // @ts-ignore
                memoryLeakThreshold: thresholds.memory.memoryLeakThreshold,
                // @ts-ignore
                gcTriggerThreshold: thresholds.memory.gcTriggerThreshold
            },
            performance: {
                // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
                domElementLimit: thresholds.performance.domElementLimit,
                // @ts-ignore
                maxDepthLimit: thresholds.performance.maxDepthLimit,
                // @ts-ignore
                largeSubtreeThreshold: thresholds.performance.largeSubtreeThreshold
            },
            dom: {
                // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
                totalElements: thresholds.dom.totalElements,
                // @ts-ignore
                maxDepth: thresholds.dom.maxDepth,
                // @ts-ignore
                largeSubtrees: thresholds.dom.largeSubtrees,
                // @ts-ignore
                elementsWarning: thresholds.dom.elementsWarning,
                // @ts-ignore
                elementsDanger: thresholds.dom.elementsDanger,
                // @ts-ignore
                depthWarning: thresholds.dom.depthWarning,
                // @ts-ignore
                depthDanger: thresholds.dom.depthDanger,
                // @ts-ignore
                largeSubtreeThreshold: thresholds.dom.largeSubtreeThreshold
            },
            interaction: {
                // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
                clickableElements: thresholds.interaction.clickableElements,
                // @ts-ignore
                formElements: thresholds.interaction.formElements,
                // @ts-ignore
                clickableHigh: thresholds.interaction.clickableHigh
            },
            layout: {
                // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
                fixedElements: thresholds.layout.fixedElements,
                // @ts-ignore
                highZIndexElements: thresholds.layout.highZIndexElements,
                // @ts-ignore
                highZIndexThreshold: thresholds.layout.highZIndexThreshold,
                // @ts-ignore
                excessiveZIndexThreshold: thresholds.layout.excessiveZIndexThreshold
            }
        };
    }
    /**
     * 特定カテゴリの閾値を取得
     */
    getDomThresholds() {
        return this.currentThresholds.dom;
    }
    getPerformanceThresholds() {
        return this.currentThresholds.performance;
    }
    getInteractionThresholds() {
        return this.currentThresholds.interaction;
    }
    getLayoutThresholds() {
        return this.currentThresholds.layout;
    }
    getExecutionTimeThresholds() {
        return this.currentThresholds.executionTime;
    }
    getMemoryThresholds() {
        return this.currentThresholds.memory;
    }
    /**
     * ランタイムでの閾値更新
     */
    updateThresholds(partialConfig) {
        const mergedConfig = this.mergeWithDefaults(partialConfig);
        const updatedThresholds = mergedConfig;
        this.validateThresholds(updatedThresholds);
        this.currentThresholds = updatedThresholds;
    }
    /**
     * 設定とデフォルト値をマージ
     * 型安全な方法ですべてのプロパティが定義されることを保証
     */
    mergeWithDefaults(config) {
        // Deep clone defaults and explicitly cast to ensure TypeScript recognizes all properties as defined
        const result = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
        // Override with provided config values using explicit checks and assignments
        if (config.executionTime) {
            if (config.executionTime.pageAnalysis !== undefined) {
                result.executionTime.pageAnalysis = config.executionTime.pageAnalysis;
            }
            if (config.executionTime.elementDiscovery !== undefined) {
                result.executionTime.elementDiscovery = config.executionTime.elementDiscovery;
            }
            if (config.executionTime.resourceMonitoring !== undefined) {
                result.executionTime.resourceMonitoring = config.executionTime.resourceMonitoring;
            }
            if (config.executionTime.parallelAnalysis !== undefined) {
                result.executionTime.parallelAnalysis = config.executionTime.parallelAnalysis;
            }
        }
        if (config.memory) {
            if (config.memory.maxMemoryUsage !== undefined) {
                result.memory.maxMemoryUsage = config.memory.maxMemoryUsage;
            }
            if (config.memory.memoryLeakThreshold !== undefined) {
                result.memory.memoryLeakThreshold = config.memory.memoryLeakThreshold;
            }
            if (config.memory.gcTriggerThreshold !== undefined) {
                result.memory.gcTriggerThreshold = config.memory.gcTriggerThreshold;
            }
        }
        if (config.performance) {
            if (config.performance.domElementLimit !== undefined) {
                result.performance.domElementLimit = config.performance.domElementLimit;
            }
            if (config.performance.maxDepthLimit !== undefined) {
                result.performance.maxDepthLimit = config.performance.maxDepthLimit;
            }
            if (config.performance.largeSubtreeThreshold !== undefined) {
                result.performance.largeSubtreeThreshold = config.performance.largeSubtreeThreshold;
            }
        }
        if (config.dom) {
            if (config.dom.totalElements !== undefined) {
                result.dom.totalElements = config.dom.totalElements;
            }
            if (config.dom.maxDepth !== undefined) {
                result.dom.maxDepth = config.dom.maxDepth;
            }
            if (config.dom.largeSubtrees !== undefined) {
                result.dom.largeSubtrees = config.dom.largeSubtrees;
            }
            if (config.dom.elementsWarning !== undefined) {
                result.dom.elementsWarning = config.dom.elementsWarning;
            }
            if (config.dom.elementsDanger !== undefined) {
                result.dom.elementsDanger = config.dom.elementsDanger;
            }
            if (config.dom.depthWarning !== undefined) {
                result.dom.depthWarning = config.dom.depthWarning;
            }
            if (config.dom.depthDanger !== undefined) {
                result.dom.depthDanger = config.dom.depthDanger;
            }
            if (config.dom.largeSubtreeThreshold !== undefined) {
                result.dom.largeSubtreeThreshold = config.dom.largeSubtreeThreshold;
            }
        }
        if (config.interaction) {
            if (config.interaction.clickableElements !== undefined) {
                result.interaction.clickableElements = config.interaction.clickableElements;
            }
            if (config.interaction.formElements !== undefined) {
                result.interaction.formElements = config.interaction.formElements;
            }
            if (config.interaction.clickableHigh !== undefined) {
                result.interaction.clickableHigh = config.interaction.clickableHigh;
            }
        }
        if (config.layout) {
            if (config.layout.fixedElements !== undefined) {
                result.layout.fixedElements = config.layout.fixedElements;
            }
            if (config.layout.highZIndexElements !== undefined) {
                result.layout.highZIndexElements = config.layout.highZIndexElements;
            }
            if (config.layout.highZIndexThreshold !== undefined) {
                result.layout.highZIndexThreshold = config.layout.highZIndexThreshold;
            }
            if (config.layout.excessiveZIndexThreshold !== undefined) {
                result.layout.excessiveZIndexThreshold = config.layout.excessiveZIndexThreshold;
            }
        }
        return result;
    }
    /**
     * 閾値設定の妥当性検証
     */
    validateThresholds(thresholds) {
        const errors = [];
        // @ts-ignore - Type-safe validation with explicit property access (guaranteed by mergeWithDefaults)
        const exec = thresholds.executionTime;
        const mem = thresholds.memory;
        const dom = thresholds.dom;
        const inter = thresholds.interaction;
        const layout = thresholds.layout;
        // 実行時間の閾値検証
        // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
        if (exec.pageAnalysis <= 0) {
            errors.push('pageAnalysis execution time must be positive');
        }
        // @ts-ignore
        if (exec.elementDiscovery <= 0) {
            errors.push('elementDiscovery execution time must be positive');
        }
        // @ts-ignore
        if (exec.resourceMonitoring <= 0) {
            errors.push('resourceMonitoring execution time must be positive');
        }
        // @ts-ignore
        if (exec.parallelAnalysis <= 0) {
            errors.push('parallelAnalysis execution time must be positive');
        }
        // メモリ閾値検証
        // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
        if (mem.maxMemoryUsage <= 0) {
            errors.push('maxMemoryUsage must be positive');
        }
        // @ts-ignore
        if (mem.memoryLeakThreshold <= 0) {
            errors.push('memoryLeakThreshold must be positive');
        }
        // @ts-ignore
        if (mem.gcTriggerThreshold <= 0) {
            errors.push('gcTriggerThreshold must be positive');
        }
        // @ts-ignore
        if (mem.memoryLeakThreshold >= mem.maxMemoryUsage) {
            errors.push('memoryLeakThreshold should be less than maxMemoryUsage');
        }
        // DOM閾値検証
        // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
        if (dom.elementsWarning <= 0) {
            errors.push('elementsWarning must be positive');
        }
        // @ts-ignore
        if (dom.elementsDanger <= dom.elementsWarning) {
            errors.push('elementsDanger must be greater than elementsWarning');
        }
        // @ts-ignore
        if (dom.depthWarning <= 0) {
            errors.push('depthWarning must be positive');
        }
        // @ts-ignore
        if (dom.depthDanger <= dom.depthWarning) {
            errors.push('depthDanger must be greater than depthWarning');
        }
        // @ts-ignore
        if (dom.largeSubtreeThreshold <= 0) {
            errors.push('largeSubtreeThreshold must be positive');
        }
        // インタラクション閾値検証
        // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
        if (inter.clickableElements <= 0) {
            errors.push('clickableElements threshold must be positive');
        }
        // @ts-ignore
        if (inter.formElements <= 0) {
            errors.push('formElements threshold must be positive');
        }
        // レイアウト閾値検証
        // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
        if (layout.highZIndexThreshold <= 0) {
            errors.push('highZIndexThreshold must be positive');
        }
        // @ts-ignore
        if (layout.excessiveZIndexThreshold <= layout.highZIndexThreshold) {
            errors.push('excessiveZIndexThreshold must be greater than highZIndexThreshold');
        }
        if (errors.length > 0) {
            throw new Error(`Invalid threshold configuration: ${errors.join(', ')}`);
        }
    }
    /**
     * 設定状態の診断情報を取得
     */
    getConfigDiagnostics() {
        const customizations = [];
        const warnings = [];
        const defaultsUsed = [];
        // デフォルト値と比較してカスタマイゼーションを検出
        const defaults = DEFAULT_THRESHOLDS;
        const current = this.currentThresholds;
        // Type-safe comparisons using local variables
        const currentDom = current.dom;
        const defaultsDom = defaults.dom;
        const currentLayout = current.layout;
        const defaultsLayout = defaults.layout;
        // DOM閾値のカスタマイゼーション検出
        if (currentDom.elementsWarning !== defaultsDom.elementsWarning) {
            customizations.push(`DOM elements warning: ${currentDom.elementsWarning} (default: ${defaultsDom.elementsWarning})`);
        }
        if (currentDom.elementsDanger !== defaultsDom.elementsDanger) {
            customizations.push(`DOM elements danger: ${currentDom.elementsDanger} (default: ${defaultsDom.elementsDanger})`);
        }
        if (currentDom.depthWarning !== defaultsDom.depthWarning) {
            customizations.push(`DOM depth warning: ${currentDom.depthWarning} (default: ${defaultsDom.depthWarning})`);
        }
        if (currentDom.depthDanger !== defaultsDom.depthDanger) {
            customizations.push(`DOM depth danger: ${currentDom.depthDanger} (default: ${defaultsDom.depthDanger})`);
        }
        // レイアウト閾値のカスタマイゼーション検出
        if (currentLayout.excessiveZIndexThreshold !== defaultsLayout.excessiveZIndexThreshold) {
            customizations.push(`Z-index excessive: ${currentLayout.excessiveZIndexThreshold} (default: ${defaultsLayout.excessiveZIndexThreshold})`);
        }
        // 警告レベルの判定
        // @ts-ignore - Properties guaranteed to be defined after mergeWithDefaults
        if (currentDom.elementsWarning > 2000) {
            warnings.push('DOM elements warning threshold is very high - may not catch performance issues early');
        }
        // @ts-ignore
        if (currentDom.depthWarning > 25) {
            warnings.push('DOM depth warning threshold is very high - deeply nested structures may cause performance issues');
        }
        // @ts-ignore
        if (currentLayout.excessiveZIndexThreshold < 1000) {
            warnings.push('Excessive z-index threshold is low - may generate false positives');
        }
        // デフォルト値が使用されている項目
        if (customizations.length === 0) {
            defaultsUsed.push('All thresholds using default values');
        }
        return {
            status: 'valid',
            customizations,
            warnings,
            defaultsUsed
        };
    }
    /**
     * デフォルト設定にリセット
     */
    resetToDefaults() {
        this.currentThresholds = { ...DEFAULT_THRESHOLDS };
    }
}
/**
 * グローバル便利関数：現在の診断閾値を取得
 */
export function getCurrentThresholds() {
    return DiagnosticThresholds.getInstance();
}
/**
 * グローバル便利関数：MetricsThresholds形式で現在の閾値を取得
 */
export function getMetricsThresholds() {
    return getCurrentThresholds().getMetricsThresholds();
}
