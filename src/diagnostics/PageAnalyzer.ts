/**
 * Page analysis for diagnostic information
 */

import type * as playwright from 'playwright';
import type { PerformanceMetrics, MetricsThresholds } from '../types/performance.js';
import { FrameReferenceManager } from './FrameReferenceManager.js';
import { ParallelPageAnalyzer } from './ParallelPageAnalyzer.js';
import { ParallelAnalysisResult } from '../types/performance.js';
import { getCurrentThresholds } from './DiagnosticThresholds.js';

export interface IDisposable {
  dispose(): Promise<void>;
}

export interface PageStructureAnalysis {
  iframes: {
    detected: boolean;
    count: number;
    accessible: Array<{ src: string; accessible: boolean }>;
    inaccessible: Array<{ src: string; reason: string }>;
  };
  modalStates: {
    hasDialog: boolean;
    hasFileChooser: boolean;
    blockedBy: string[];
  };
  elements: {
    totalVisible: number;
    totalInteractable: number;
    missingAria: number;
  };
}

export class PageAnalyzer implements IDisposable {
  private readonly metricsThresholds: MetricsThresholds;

  private isDisposed = false;
  private frameRefs: Set<playwright.Frame> = new Set();
  private frameManager: FrameReferenceManager;

  constructor(private page: playwright.Page | null) {
    this.frameManager = new FrameReferenceManager();
    // Get thresholds from configuration system (eliminate hardcoding)
    this.metricsThresholds = getCurrentThresholds().getMetricsThresholds();
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
    
    try {
      await this.frameManager.dispose();
    } catch (error) {
      console.warn('[PageAnalyzer] Failed to dispose frame manager:', error);
    }
    
    this.frameRefs.clear();
    this.page = null;
    this.isDisposed = true;
  }

  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('PageAnalyzer has been disposed');
    }
  }

  private getPage(): playwright.Page {
    this.checkDisposed();
    if (!this.page) {
      throw new Error('Page reference is null');
    }
    return this.page;
  }

  async analyzePageStructure(): Promise<PageStructureAnalysis> {
    const page = this.getPage();
    const [iframes, modalStates, elements] = await Promise.all([
      this.analyzeIframes(),
      this.analyzeModalStates(),
      this.analyzeElements()
    ]);

    return {
      iframes,
      modalStates,
      elements
    };
  }

  private async analyzeIframes() {
    const page = this.getPage();
    const iframes = await page.$$('iframe');
    const detected = iframes.length > 0;
    const accessible: Array<{ src: string; accessible: boolean }> = [];
    const inaccessible: Array<{ src: string; reason: string }> = [];

    // Dispose iframes immediately after processing to prevent leaks
    try {
      for (const iframe of iframes) {
        const src = await iframe.getAttribute('src') || 'about:blank';
        
        try {
          // Try to access the iframe's content
          const frame = await iframe.contentFrame();
          if (frame) {
            // Track frame in frame manager
            this.frameManager.trackFrame(frame);
            this.frameRefs.add(frame);
            
            try {
              // Try to access frame content with timeout to verify it's truly accessible
              await Promise.race([
                frame.url(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
              ]);
              accessible.push({ src, accessible: true });
              
              // Update frame metadata with element count for performance tracking
              try {
                const elementCount = await frame.$$eval('*', elements => elements.length);
                this.frameManager.updateElementCount(frame, elementCount);
              } catch (countError) {
                // Element counting failed, but frame is still accessible
                console.warn('[PageAnalyzer] Failed to count frame elements:', countError);
              }
              
            } catch (frameError) {
              inaccessible.push({ 
                src, 
                reason: 'Frame content not accessible - cross-origin or blocked'
              });
            }
          } else {
            inaccessible.push({ 
              src, 
              reason: 'Content frame not available'
            });
          }
        } catch (error) {
          inaccessible.push({ 
            src, 
            reason: error instanceof Error ? error.message : 'Access denied'
          });
        } finally {
          // Dispose iframe element handle to prevent memory leak
          try {
            await iframe.dispose();
          } catch (disposeError) {
            console.warn('[PageAnalyzer] Failed to dispose iframe element:', disposeError);
          }
        }
      }

      // Clean up any detached frames after analysis
      await this.frameManager.cleanupDetachedFrames();

    } catch (error) {
      console.error('[PageAnalyzer] iframe analysis failed:', error);
      // Ensure cleanup even on error
      for (const iframe of iframes) {
        try {
          await iframe.dispose();
        } catch (disposeError) {
          // Ignore disposal errors during error cleanup
        }
      }
      throw error;
    }

    return {
      detected,
      count: iframes.length,
      accessible,
      inaccessible
    };
  }

  private async analyzeModalStates() {
    const page = this.getPage();
    const blockedBy: string[] = [];
    let hasDialog = false;
    let hasFileChooser = false;

    try {
      // Check for active dialogs by evaluating page state
      hasDialog = await page.evaluate(() => {
        // Check for common modal indicators
        const modals = document.querySelectorAll('[role="dialog"], .modal, .dialog, .popup');
        const overlays = document.querySelectorAll('.overlay, .modal-backdrop, .dialog-backdrop');
        return modals.length > 0 || overlays.length > 0;
      });

      // Check for file choosers by looking for file inputs that are being interacted with
      hasFileChooser = await page.evaluate(() => {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        return Array.from(fileInputs).some(input => {
          const style = window.getComputedStyle(input);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
      });

    } catch (error) {
      // If evaluation fails, assume no modals (page might not be ready)
      hasDialog = false;
      hasFileChooser = false;
    }

    if (hasDialog) blockedBy.push('dialog');
    if (hasFileChooser) blockedBy.push('fileChooser');

    return {
      hasDialog,
      hasFileChooser,
      blockedBy
    };
  }

  private async analyzeElements() {
    const page = this.getPage();
    const elementStats = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let totalVisible = 0;
      let totalInteractable = 0;
      let missingAria = 0;

      for (const element of allElements) {
        const style = window.getComputedStyle(element);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
        
        if (isVisible) {
          totalVisible++;
          
          // Check if element is interactable
          const tagName = element.tagName.toLowerCase();
          const isInteractable = ['button', 'input', 'select', 'textarea', 'a'].includes(tagName) ||
                                 element.hasAttribute('onclick') ||
                                 element.hasAttribute('role');
          
          if (isInteractable) {
            totalInteractable++;
            
            // Check for missing ARIA attributes
            if (!element.hasAttribute('aria-label') && 
                !element.hasAttribute('aria-labelledby') && 
                !element.textContent?.trim()) {
              missingAria++;
            }
          }
        }
      }

      return { totalVisible, totalInteractable, missingAria };
    });

    return elementStats;
  }

  async analyzePerformanceMetrics(): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const page = this.getPage();
    
    try {
      const metricsData = await page.evaluate(() => {
        // DOM complexity analysis using TreeWalker for efficiency
        const getAllElementsWithTreeWalker = () => {
          const elements: Element[] = [];
          const walker = document.createTreeWalker(
            document.documentElement,
            NodeFilter.SHOW_ELEMENT,
            null
          );
          
          let node: Node | null;
          while (node = walker.nextNode()) {
            elements.push(node as Element);
          }
          return elements;
        };
        
        const allElements = getAllElementsWithTreeWalker();
        const totalElements = allElements.length;

        // Calculate DOM depth
        const getMaxDepth = (element: Element, currentDepth = 0): number => {
          let maxChildDepth = currentDepth;
          for (const child of Array.from(element.children)) {
            const childDepth = getMaxDepth(child, currentDepth + 1);
            maxChildDepth = Math.max(maxChildDepth, childDepth);
          }
          return maxChildDepth;
        };
        const maxDepth = getMaxDepth(document.documentElement);

        // Find large subtrees using TreeWalker for efficiency
        const largeSubtrees: Array<{ selector: string; elementCount: number; description: string }> = [];
        const countDescendants = (rootElement: Element): number => {
          const walker = document.createTreeWalker(
            rootElement,
            NodeFilter.SHOW_ELEMENT,
            null
          );
          let count = 0;
          while (walker.nextNode()) {
            count++;
          }
          return count - 1; // Exclude the root element itself
        };
        
        const analyzeSubtree = (element: Element, selector: string) => {
          const descendantCount = countDescendants(element);
          if (descendantCount >= 500) {
            const tagName = element.tagName.toLowerCase();
            const id = element.id ? `#${element.id}` : '';
            const className = element.className ? `.${element.className.split(' ')[0]}` : '';
            const fullSelector = `${tagName}${id}${className}`;
            
            let description = 'Large subtree';
            if (tagName === 'ul' || tagName === 'ol') {
              description = 'Large list structure';
            } else if (tagName === 'table') {
              description = 'Large table structure';
            } else if (tagName === 'div' && (element.className.includes('container') || element.className.includes('wrapper'))) {
              description = 'Large container element';
            }

            largeSubtrees.push({
              selector: fullSelector || selector,
              elementCount: descendantCount,
              description
            });
          }
        };

        // Check body and major containers for large subtrees
        if (document.body) {
          analyzeSubtree(document.body, 'body');
          const containers = document.body.querySelectorAll('div, section, main, article, aside');
          containers.forEach((container, index) => {
            analyzeSubtree(container, `container-${index}`);
          });
        }

        // Interaction elements analysis using efficient element filtering
        let clickableElements = 0;
        let formElements = 0;
        let disabledElements = 0;
        
        // Analyze elements in a single pass for efficiency
        allElements.forEach(element => {
          const tagName = element.tagName.toLowerCase();
          const type = (element as HTMLInputElement).type?.toLowerCase();
          
          // Check if clickable
          if (
            tagName === 'button' ||
            (tagName === 'input' && ['button', 'submit', 'reset'].includes(type || '')) ||
            (tagName === 'a' && element.hasAttribute('href')) ||
            element.hasAttribute('onclick') ||
            element.getAttribute('role') === 'button' ||
            element.getAttribute('role') === 'link' ||
            (element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1')
          ) {
            clickableElements++;
          }
          
          // Check if form element
          if (['input', 'select', 'textarea'].includes(tagName) || 
              (tagName === 'button' && type === 'submit')) {
            formElements++;
          }
          
          // Check if disabled
          if ((element as HTMLElement).hasAttribute('disabled') || 
              element.getAttribute('aria-disabled') === 'true') {
            disabledElements++;
          }
        });

        // Resource analysis
        const images = document.querySelectorAll('img');
        const imageCount = images.length;
        let estimatedImageSize = 0;
        let sizeDescription = 'Small (estimated)';
        
        if (imageCount > 0) {
          // Rough estimation based on image count and common sizes
          estimatedImageSize = imageCount * 50; // Assume 50KB per image on average
          if (estimatedImageSize > 1000) {
            sizeDescription = 'Large (>1MB estimated)';
          } else if (estimatedImageSize > 500) {
            sizeDescription = 'Medium (>500KB estimated)';
          }
        }

        const scriptTags = document.querySelectorAll('script').length;
        const inlineScripts = document.querySelectorAll('script:not([src])').length;
        const externalScripts = scriptTags - inlineScripts;
        const stylesheetCount = document.querySelectorAll('link[rel="stylesheet"], style').length;

        // Layout analysis
        const fixedElements: Array<{ selector: string; purpose: string; zIndex: number }> = [];
        const highZIndexElements: Array<{ selector: string; zIndex: number; description: string }> = [];
        let overflowHiddenElements = 0;

        allElements.forEach((element, index) => {
          const style = window.getComputedStyle(element);
          const position = style.position;
          const zIndex = parseInt(style.zIndex || '0', 10);

          // Fixed elements analysis
          if (position === 'fixed') {
            const tagName = element.tagName.toLowerCase();
            let purpose = 'Unknown fixed element';
            
            if (tagName === 'nav' || element.getAttribute('role') === 'navigation' || 
                element.className.toLowerCase().includes('nav')) {
              purpose = 'Fixed navigation element';
            } else if (tagName === 'header' || element.className.toLowerCase().includes('header')) {
              purpose = 'Fixed header element';
            } else if (element.className.toLowerCase().includes('modal') || 
                       element.className.toLowerCase().includes('dialog')) {
              purpose = 'Modal or dialog overlay';
            } else if (element.className.toLowerCase().includes('toolbar') || 
                       element.className.toLowerCase().includes('controls')) {
              purpose = 'Fixed toolbar or controls';
            }

            fixedElements.push({
              selector: element.id ? `#${element.id}` : `${tagName}:nth-child(${index + 1})`,
              purpose,
              zIndex
            });
          }

          // High z-index elements
          if (zIndex >= 1000) {
            let description = 'High z-index element';
            if (zIndex >= 9999) {
              description = 'Extremely high z-index (potential issue)';
            } else if (element.className.toLowerCase().includes('modal')) {
              description = 'Modal with high z-index';
            } else if (element.className.toLowerCase().includes('tooltip')) {
              description = 'Tooltip with high z-index';
            }

            highZIndexElements.push({
              selector: element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}:nth-child(${index + 1})`,
              zIndex,
              description
            });
          }

          // Overflow hidden elements
          if (style.overflow === 'hidden') {
            overflowHiddenElements++;
          }
        });

        return {
          dom: {
            totalElements,
            maxDepth,
            largeSubtrees
          },
          interaction: {
            clickableElements,
            formElements,
            disabledElements
          },
          resource: {
            imageCount,
            estimatedImageSize: sizeDescription,
            scriptTags,
            inlineScripts,
            externalScripts,
            stylesheetCount
          },
          layout: {
            fixedElements,
            highZIndexElements,
            overflowHiddenElements
          }
        };
      });

      // Generate warnings based on metrics
      const warnings: PerformanceMetrics['warnings'] = [];

      // DOM complexity warnings
      if (metricsData.dom.totalElements >= this.metricsThresholds.dom.elementsDanger) {
        warnings.push({
          type: 'dom_complexity',
          level: 'danger',
          message: `Very high DOM complexity: ${metricsData.dom.totalElements} elements (threshold: ${this.metricsThresholds.dom.elementsDanger})`
        });
      } else if (metricsData.dom.totalElements >= this.metricsThresholds.dom.elementsWarning) {
        warnings.push({
          type: 'dom_complexity',
          level: 'warning',
          message: `High DOM complexity: ${metricsData.dom.totalElements} elements (threshold: ${this.metricsThresholds.dom.elementsWarning})`
        });
      }

      if (metricsData.dom.maxDepth >= this.metricsThresholds.dom.depthDanger) {
        warnings.push({
          type: 'dom_complexity',
          level: 'danger',
          message: `Very deep DOM structure: ${metricsData.dom.maxDepth} levels (threshold: ${this.metricsThresholds.dom.depthDanger})`
        });
      } else if (metricsData.dom.maxDepth >= this.metricsThresholds.dom.depthWarning) {
        warnings.push({
          type: 'dom_complexity',
          level: 'warning',
          message: `Deep DOM structure: ${metricsData.dom.maxDepth} levels (threshold: ${this.metricsThresholds.dom.depthWarning})`
        });
      }

      // Interaction overload warnings
      if (metricsData.interaction.clickableElements >= this.metricsThresholds.interaction.clickableHigh) {
        warnings.push({
          type: 'interaction_overload',
          level: 'warning',
          message: `High number of clickable elements: ${metricsData.interaction.clickableElements} (threshold: ${this.metricsThresholds.interaction.clickableHigh})`
        });
      }

      // Layout issue warnings
      if (metricsData.layout.highZIndexElements.some(el => el.zIndex >= this.metricsThresholds.layout.excessiveZIndexThreshold)) {
        warnings.push({
          type: 'layout_issue',
          level: 'warning',
          message: `Elements with excessive z-index values detected (>=${this.metricsThresholds.layout.excessiveZIndexThreshold})`
        });
      }

      // Resource warnings
      if (metricsData.resource.imageCount > 20) {
        warnings.push({
          type: 'resource_heavy',
          level: 'warning',
          message: `High number of images: ${metricsData.resource.imageCount} (may impact loading performance)`
        });
      }

      const executionTime = Date.now() - startTime;
      if (executionTime > 1000) {
        console.warn(`[Performance] analyzePerformanceMetrics took ${executionTime}ms (target: <1000ms)`);
      }

      return {
        executionTime,
        memoryUsage: process.memoryUsage().heapUsed,
        operationCount: 1,
        errorCount: 0,
        successRate: 1.0,
        domMetrics: metricsData.dom,
        interactionMetrics: metricsData.interaction,
        resourceMetrics: metricsData.resource,
        layoutMetrics: metricsData.layout,
        warnings
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[Performance] analyzePerformanceMetrics failed after ${executionTime}ms:`, error);
      
      // Return minimal fallback metrics
      return {
        executionTime,
        memoryUsage: process.memoryUsage().heapUsed,
        operationCount: 1,
        errorCount: 1,
        successRate: 0.0,
        domMetrics: {
          totalElements: 0,
          maxDepth: 0,
          largeSubtrees: []
        },
        interactionMetrics: {
          clickableElements: 0,
          formElements: 0,
          disabledElements: 0
        },
        resourceMetrics: {
          imageCount: 0,
          estimatedImageSize: 'Unknown',
          scriptTags: 0,
          inlineScripts: 0,
          externalScripts: 0,
          stylesheetCount: 0
        },
        layoutMetrics: {
          fixedElements: [],
          highZIndexElements: [],
          overflowHiddenElements: 0
        },
        warnings: [{
          type: 'dom_complexity',
          level: 'danger',
          message: `Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Get frame management statistics for monitoring memory usage
   */
  getFrameStats(): {
    frameStats: {
      activeCount: number;
      totalTracked: number;
      detachedCount: number;
      averageElementCount: number;
    };
    performanceIssues: {
      largeFrames: Array<{ frame: playwright.Frame; elementCount: number; url: string }>;
      oldFrames: Array<{ frame: playwright.Frame; age: number; url: string }>;
    };
    isDisposed: boolean;
  } {
    if (this.isDisposed) {
      return {
        frameStats: {
          activeCount: 0,
          totalTracked: 0,
          detachedCount: 0,
          averageElementCount: 0
        },
        performanceIssues: {
          largeFrames: [],
          oldFrames: []
        },
        isDisposed: true
      };
    }

    const frameStats = this.frameManager.getStatistics();
    const performanceIssues = this.frameManager.findPerformanceIssues();

    return {
      frameStats,
      performanceIssues,
      isDisposed: false
    };
  }

  /**
   * Manual cleanup of detached frames
   */
  async cleanupFrames(): Promise<void> {
    if (this.isDisposed) return;
    await this.frameManager.cleanupDetachedFrames();
  }

  /**
   * Phase 2: Run parallel analysis with resource monitoring
   * Combines structure and performance analysis in parallel execution
   */
  async runParallelAnalysis(): Promise<ParallelAnalysisResult> {
    const page = this.getPage();
    const parallelAnalyzer = new ParallelPageAnalyzer(page);
    
    try {
      return await parallelAnalyzer.runParallelAnalysis();
    } catch (error) {
      throw new Error(`Parallel analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Phase 2: Get enhanced diagnostic information with resource monitoring
   * Returns both analysis results and resource usage information
   */
  async getEnhancedDiagnostics(): Promise<{
    parallelAnalysis: ParallelAnalysisResult;
    frameStats: {
      frameStats: {
        activeCount: number;
        totalTracked: number;
        detachedCount: number;
        averageElementCount: number;
      };
      performanceIssues: {
        largeFrames: Array<{ frame: any; elementCount: number; url: string }>;
        oldFrames: Array<{ frame: any; age: number; url: string }>;
      };
      isDisposed: boolean;
    };
    timestamp: number;
  }> {
    const [parallelAnalysis, frameStats] = await Promise.all([
      this.runParallelAnalysis(),
      Promise.resolve(this.getFrameStats())
    ]);

    return {
      parallelAnalysis,
      frameStats,
      timestamp: Date.now()
    };
  }

  /**
   * Phase 2: Check if parallel analysis should be used based on page complexity
   * Returns recommendation for using parallel vs sequential analysis
   */
  async shouldUseParallelAnalysis(): Promise<{
    recommended: boolean;
    reason: string;
    estimatedBenefit: string;
  }> {
    const page = this.getPage();
    
    try {
      console.info('[PageAnalyzer] Evaluating parallel analysis recommendation');
      
      // Quick DOM complexity check
      const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
      const iframeCount = await page.evaluate(() => document.querySelectorAll('iframe').length);
      const formElements = await page.evaluate(() => 
        document.querySelectorAll('input, button, select, textarea').length
      );
      
      const complexity = elementCount + (iframeCount * 100) + (formElements * 10);
      console.info(`[PageAnalyzer] Page complexity analysis - elements: ${elementCount}, iframes: ${iframeCount}, forms: ${formElements}, complexity score: ${complexity}`);
      
      if (complexity > 2000) {
        console.info('[PageAnalyzer] HIGH complexity detected - parallel analysis strongly recommended');
        return {
          recommended: true,
          reason: `High page complexity detected (elements: ${elementCount}, iframes: ${iframeCount})`,
          estimatedBenefit: 'Expected 40-60% performance improvement'
        };
      } else if (complexity > 1000) {
        console.info('[PageAnalyzer] MODERATE complexity detected - parallel analysis recommended');
        return {
          recommended: true,
          reason: 'Moderate complexity - parallel analysis will provide better resource monitoring',
          estimatedBenefit: 'Expected 20-40% performance improvement'
        };
      } else {
        console.info('[PageAnalyzer] LOW complexity detected - sequential analysis sufficient');
        return {
          recommended: false,
          reason: 'Low complexity page - sequential analysis sufficient',
          estimatedBenefit: 'Minimal performance difference expected'
        };
      }
    } catch (error) {
      console.warn('[PageAnalyzer] Error evaluating complexity - defaulting to parallel analysis:', error);
      return {
        recommended: true,
        reason: 'Unable to assess complexity - using parallel analysis as fallback',
        estimatedBenefit: 'Resource monitoring and error handling benefits'
      };
    }
  }
}