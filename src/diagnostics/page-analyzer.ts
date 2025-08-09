/**
 * Page analysis for diagnostic information
 */

import type * as playwright from 'playwright';
import type {
  MetricsThresholds,
  ParallelAnalysisResult,
  PerformanceMetrics,
} from '../types/performance.js';
import {
  createDiagnosticLogger,
  DiagnosticBase,
} from './common/diagnostic-base.js';
import { getCurrentThresholds } from './diagnostic-thresholds.js';
import { FrameReferenceManager } from './frame-reference-manager.js';
import { ParallelPageAnalyzer } from './parallel-page-analyzer.js';

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

export class PageAnalyzer extends DiagnosticBase {
  private readonly metricsThresholds: MetricsThresholds;
  private readonly frameRefs: Set<playwright.Frame> = new Set();
  private readonly frameManager: FrameReferenceManager;
  private readonly logger: ReturnType<typeof createDiagnosticLogger>;

  constructor(page: playwright.Page | null) {
    super(page, 'PageAnalyzer');
    this.frameManager = new FrameReferenceManager();
    this.logger = createDiagnosticLogger('PageAnalyzer', 'analysis');
    // Get thresholds from configuration system (eliminate hardcoding)
    this.metricsThresholds = getCurrentThresholds().getMetricsThresholds();
  }

  protected async performDispose(): Promise<void> {
    try {
      await this.frameManager.dispose();
    } catch (error) {
      this.logger.warn('Failed to dispose frame manager', error);
    }

    this.frameRefs.clear();
  }

  async analyzePageStructure(): Promise<PageStructureAnalysis> {
    this.getPage();
    const [iframes, modalStates, elements] = await Promise.all([
      this.analyzeIframes(),
      this.analyzeModalStates(),
      this.analyzeElements(),
    ]);

    return {
      iframes,
      modalStates,
      elements,
    };
  }

  private async analyzeIframes() {
    const page = this.getPage();
    const iframes = await page.$$('iframe');
    const detected = iframes.length > 0;
    const accessible: Array<{ src: string; accessible: boolean }> = [];
    const inaccessible: Array<{ src: string; reason: string }> = [];

    try {
      await this.processIframes(iframes, accessible, inaccessible);
      await this.frameManager.cleanupDetachedFrames();
    } catch (error) {
      await this.cleanupIframesOnError(iframes);
      throw error;
    }

    return {
      detected,
      count: iframes.length,
      accessible,
      inaccessible,
    };
  }

  private async processIframes(
    iframes: playwright.ElementHandle[],
    accessible: Array<{ src: string; accessible: boolean }>,
    inaccessible: Array<{ src: string; reason: string }>
  ): Promise<void> {
    // Process iframes sequentially to avoid overwhelming the browser
    for (const iframe of iframes) {
      // biome-ignore lint/nursery/noAwaitInLoop: sequential processing prevents browser overload
      const src = (await iframe.getAttribute('src')) ?? 'about:blank';

      try {
        await this.processIndividualIframe(
          iframe,
          src,
          accessible,
          inaccessible
        );
      } catch (error) {
        this.addInaccessibleIframe(inaccessible, src, error);
      } finally {
        await this.disposeIframeElement(iframe);
      }
    }
  }

  private async processIndividualIframe(
    iframe: playwright.ElementHandle,
    src: string,
    accessible: Array<{ src: string; accessible: boolean }>,
    inaccessible: Array<{ src: string; reason: string }>
  ): Promise<void> {
    const frame = await iframe.contentFrame();
    if (!frame) {
      inaccessible.push({
        src,
        reason: 'Content frame not available',
      });
      return;
    }

    this.frameManager.trackFrame(frame);
    this.frameRefs.add(frame);

    try {
      await this.verifyFrameAccessibility(frame);
      accessible.push({ src, accessible: true });
      await this.updateFrameMetadata(frame);
    } catch (frameError) {
      // Log frame access error for debugging
      this.logger.debug('Frame access failed:', {
        src,
        error:
          frameError instanceof Error ? frameError.message : 'Unknown error',
      });
      inaccessible.push({
        src,
        reason: 'Frame content not accessible - cross-origin or blocked',
      });
    }
  }

  private async verifyFrameAccessibility(
    frame: playwright.Frame
  ): Promise<void> {
    await Promise.race([
      frame.url(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 1000)
      ),
    ]);
  }

  private async updateFrameMetadata(frame: playwright.Frame): Promise<void> {
    try {
      const elementCount = await frame.$$eval(
        '*',
        (elements: Element[]) => elements.length
      );
      this.frameManager.updateElementCount(frame, elementCount);
    } catch (countError) {
      this.logger.warn('Failed to count frame elements', countError);
    }
  }

  private addInaccessibleIframe(
    inaccessible: Array<{ src: string; reason: string }>,
    src: string,
    error: unknown
  ): void {
    inaccessible.push({
      src,
      reason: error instanceof Error ? error.message : 'Access denied',
    });
  }

  private async disposeIframeElement(
    iframe: playwright.ElementHandle
  ): Promise<void> {
    try {
      await iframe.dispose();
    } catch (disposeError) {
      this.logger.warn('Failed to dispose iframe element', disposeError);
    }
  }

  private async cleanupIframesOnError(
    iframes: playwright.ElementHandle[]
  ): Promise<void> {
    await Promise.all(
      iframes.map(async (iframe) => {
        try {
          await iframe.dispose();
        } catch (disposeError) {
          this.logger.warn(
            'Error during iframe disposal cleanup',
            disposeError
          );
        }
      })
    );
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
        const modals = document.querySelectorAll(
          '[role="dialog"], .modal, .dialog, .popup'
        );
        const overlays = document.querySelectorAll(
          '.overlay, .modal-backdrop, .dialog-backdrop'
        );
        return modals.length > 0 || overlays.length > 0;
      });

      // Check for file choosers by looking for file inputs that are being interacted with
      hasFileChooser = await page.evaluate(() => {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        return Array.from(fileInputs).some((input) => {
          const style = window.getComputedStyle(input);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
      });
    } catch (error) {
      // If evaluation fails, assume no modals (page might not be ready)
      this.logger.warn('Failed to evaluate modal states:', error);
      hasDialog = false;
      hasFileChooser = false;
    }

    if (hasDialog) {
      blockedBy.push('dialog');
    }
    if (hasFileChooser) {
      blockedBy.push('fileChooser');
    }

    return {
      hasDialog,
      hasFileChooser,
      blockedBy,
    };
  }

  private async analyzeElements() {
    const page = this.getPage();
    const elementStats = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      let totalVisible = 0;
      let totalInteractable = 0;
      let missingAria = 0;

      const isElementVisible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };

      const isElementInteractable = (element: Element): boolean => {
        const tagName = element.tagName.toLowerCase();
        return (
          ['button', 'input', 'select', 'textarea', 'a'].includes(tagName) ||
          element.hasAttribute('onclick') ||
          element.hasAttribute('role')
        );
      };

      const hasMissingAriaAttributes = (element: Element): boolean => {
        return !(
          element.hasAttribute('aria-label') ||
          element.hasAttribute('aria-labelledby') ||
          element.textContent?.trim()
        );
      };

      for (const element of allElements) {
        if (isElementVisible(element)) {
          totalVisible++;

          if (isElementInteractable(element)) {
            totalInteractable++;

            if (hasMissingAriaAttributes(element)) {
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
        const getAllElementsWithTreeWalker = () => {
          const elements: Element[] = [];
          const walker = document.createTreeWalker(
            document.documentElement,
            NodeFilter.SHOW_ELEMENT,
            null
          );

          let node: Node | null = walker.nextNode();
          while (node !== null) {
            elements.push(node as Element);
            node = walker.nextNode();
          }

          return elements;
        };

        const getMaxDepth = (element: Element, currentDepth = 0): number => {
          let maxChildDepth = currentDepth;
          for (const child of Array.from(element.children)) {
            const childDepth = getMaxDepth(child, currentDepth + 1);
            maxChildDepth = Math.max(maxChildDepth, childDepth);
          }
          return maxChildDepth;
        };

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
          return count - 1;
        };

        const getSubtreeDescription = (
          tagName: string,
          element: Element
        ): string => {
          if (tagName === 'ul' || tagName === 'ol') {
            return 'Large list structure';
          }
          if (tagName === 'table') {
            return 'Large table structure';
          }
          if (
            tagName === 'div' &&
            (element.className.includes('container') ||
              element.className.includes('wrapper'))
          ) {
            return 'Large container element';
          }
          return 'Large subtree';
        };

        const buildElementSelector = (element: Element): string => {
          const tagName = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : '';
          const className = element.className
            ? `.${element.className.split(' ')[0]}`
            : '';
          return `${tagName}${id}${className}`;
        };

        const analyzeSubtree = (
          element: Element,
          selector: string,
          subtreeArray: Array<{
            selector: string;
            elementCount: number;
            description: string;
          }>
        ) => {
          const descendantCount = countDescendants(element);
          if (descendantCount >= 500) {
            const tagName = element.tagName.toLowerCase();
            const fullSelector = buildElementSelector(element);
            const description = getSubtreeDescription(tagName, element);

            subtreeArray.push({
              selector: fullSelector || selector,
              elementCount: descendantCount,
              description,
            });
          }
        };

        const analyzeLargeSubtrees = () => {
          const largeSubtrees: Array<{
            selector: string;
            elementCount: number;
            description: string;
          }> = [];

          if (document.body) {
            analyzeSubtree(document.body, 'body', largeSubtrees);
            const containers = Array.from(
              document.body.querySelectorAll(
                'div, section, main, article, aside'
              )
            );
            for (let index = 0; index < containers.length; index++) {
              const container = containers[index];
              analyzeSubtree(container, `container-${index}`, largeSubtrees);
            }
          }

          return largeSubtrees;
        };

        const isClickableElement = (
          element: Element,
          tagName: string,
          type?: string
        ): boolean => {
          return (
            tagName === 'button' ||
            (tagName === 'input' &&
              ['button', 'submit', 'reset'].includes(type ?? '')) ||
            (tagName === 'a' && element.hasAttribute('href')) ||
            element.hasAttribute('onclick') ||
            element.getAttribute('role') === 'button' ||
            element.getAttribute('role') === 'link' ||
            (element.hasAttribute('tabindex') &&
              element.getAttribute('tabindex') !== '-1')
          );
        };

        const isFormElement = (tagName: string, type?: string): boolean => {
          return (
            ['input', 'select', 'textarea'].includes(tagName) ||
            (tagName === 'button' && type === 'submit')
          );
        };

        const isDisabledElement = (element: Element): boolean => {
          return (
            (element as HTMLElement).hasAttribute('disabled') ||
            element.getAttribute('aria-disabled') === 'true'
          );
        };

        const analyzeInteractionElements = (elements: Element[]) => {
          let clickableElements = 0;
          let formElements = 0;
          let disabledElements = 0;

          for (const element of elements) {
            const tagName = element.tagName.toLowerCase();
            const type = (element as HTMLInputElement).type?.toLowerCase();

            if (isClickableElement(element, tagName, type)) {
              clickableElements++;
            }

            if (isFormElement(tagName, type)) {
              formElements++;
            }

            if (isDisabledElement(element)) {
              disabledElements++;
            }
          }

          const iframes = document.querySelectorAll('iframe').length;
          return { clickableElements, formElements, disabledElements, iframes };
        };

        const analyzeResourceMetrics = () => {
          const images = document.querySelectorAll('img');
          const imageCount = images.length;
          let sizeDescription = 'Small (estimated)';

          if (imageCount > 0) {
            const estimatedImageSize = imageCount * 50;
            if (estimatedImageSize > 1000) {
              sizeDescription = 'Large (>1MB estimated)';
            } else if (estimatedImageSize > 500) {
              sizeDescription = 'Medium (>500KB estimated)';
            }
          }

          const scriptTags = document.querySelectorAll('script').length;
          const inlineScripts =
            document.querySelectorAll('script:not([src])').length;
          const externalScripts = scriptTags - inlineScripts;
          const stylesheetCount = document.querySelectorAll(
            'link[rel="stylesheet"], style'
          ).length;

          return {
            totalRequests: 0, // We don't track actual network requests in DOM analysis
            totalSize: 0, // We don't have actual size data
            loadTime: 0, // We don't track load time in DOM analysis
            imageCount,
            estimatedImageSize: sizeDescription,
            scriptTags,
            inlineScripts,
            externalScripts,
            stylesheetCount,
          };
        };

        const getFixedElementPurpose = (
          tagName: string,
          element: Element
        ): string => {
          const className = element.className.toLowerCase();

          if (isNavigationElement(tagName, element, className)) {
            return 'Fixed navigation element';
          }

          if (isHeaderElement(tagName, className)) {
            return 'Fixed header element';
          }

          if (isModalElement(className)) {
            return 'Modal or dialog overlay';
          }

          if (isToolbarElement(className)) {
            return 'Fixed toolbar or controls';
          }

          return 'Unknown fixed element';
        };

        const isNavigationElement = (
          tagName: string,
          element: Element,
          className: string
        ): boolean => {
          return (
            tagName === 'nav' ||
            element.getAttribute('role') === 'navigation' ||
            className.includes('nav')
          );
        };

        const isHeaderElement = (
          tagName: string,
          className: string
        ): boolean => {
          return tagName === 'header' || className.includes('header');
        };

        const isModalElement = (className: string): boolean => {
          return className.includes('modal') || className.includes('dialog');
        };

        const isToolbarElement = (className: string): boolean => {
          return (
            className.includes('toolbar') || className.includes('controls')
          );
        };

        const getZIndexDescription = (
          zIndex: number,
          element: Element
        ): string => {
          if (zIndex >= 9999) {
            return 'Extremely high z-index (potential issue)';
          }
          if (element.className.toLowerCase().includes('modal')) {
            return 'Modal with high z-index';
          }
          if (element.className.toLowerCase().includes('tooltip')) {
            return 'Tooltip with high z-index';
          }
          return 'High z-index element';
        };

        const analyzeLayoutElements = (elements: Element[]) => {
          const results = {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
            fixedElements: [] as Array<{
              selector: string;
              purpose: string;
              zIndex: number;
            }>,
            highZIndexElements: [] as Array<{
              selector: string;
              zIndex: number;
              description: string;
            }>,
            overflowHiddenElements: 0,
          };

          for (let index = 0; index < elements.length; index++) {
            const element = elements[index];
            const style = window.getComputedStyle(element);
            processElementLayout(element, style, index, results);
          }

          return results;
        };

        const processElementLayout = (
          element: Element,
          style: CSSStyleDeclaration,
          index: number,
          results: {
            fixedElements: Array<{
              selector: string;
              purpose: string;
              zIndex: number;
            }>;
            highZIndexElements: Array<{
              selector: string;
              zIndex: number;
              description: string;
            }>;
            overflowHiddenElements: number;
          }
        ): void => {
          const position = style.position;
          const zIndex = Number.parseInt(style.zIndex ?? '0', 10);
          const tagName = element.tagName.toLowerCase();

          if (position === 'fixed') {
            processFixedElement(
              element,
              tagName,
              zIndex,
              index,
              results.fixedElements
            );
          }

          if (zIndex >= 1000) {
            processHighZIndexElement(
              element,
              zIndex,
              index,
              results.highZIndexElements
            );
          }

          if (style.overflow === 'hidden') {
            results.overflowHiddenElements++;
          }
        };

        const processFixedElement = (
          element: Element,
          tagName: string,
          zIndex: number,
          index: number,
          fixedElements: Array<{
            selector: string;
            purpose: string;
            zIndex: number;
          }>
        ): void => {
          const purpose = getFixedElementPurpose(tagName, element);
          const selector = generateElementSelector(element, tagName, index);

          fixedElements.push({ selector, purpose, zIndex });
        };

        const processHighZIndexElement = (
          element: Element,
          zIndex: number,
          index: number,
          highZIndexElements: Array<{
            selector: string;
            zIndex: number;
            description: string;
          }>
        ): void => {
          const description = getZIndexDescription(zIndex, element);
          const selector = generateElementSelector(
            element,
            element.tagName.toLowerCase(),
            index
          );

          highZIndexElements.push({ selector, zIndex, description });
        };

        const generateElementSelector = (
          element: Element,
          tagName: string,
          index: number
        ): string => {
          return element.id
            ? `#${element.id}`
            : `${tagName}:nth-child(${index + 1})`;
        };

        const allElements = getAllElementsWithTreeWalker();
        const totalElements = allElements.length;
        const maxDepth = getMaxDepth(document.documentElement);
        const largeSubtrees = analyzeLargeSubtrees();
        const interaction = analyzeInteractionElements(allElements);
        const resource = analyzeResourceMetrics();
        const layout = analyzeLayoutElements(allElements);

        return {
          dom: {
            totalElements,
            maxDepth,
            largeSubtrees,
          },
          interaction,
          resource,
          layout,
        };
      });

      // Generate warnings based on metrics
      const warnings: PerformanceMetrics['warnings'] = [];

      // DOM complexity warnings
      if (
        metricsData.dom.totalElements >=
        this.metricsThresholds.dom.elementsDanger
      ) {
        warnings.push({
          type: 'dom_complexity',
          level: 'danger',
          message: `Very high DOM complexity: ${metricsData.dom.totalElements} elements (threshold: ${this.metricsThresholds.dom.elementsDanger})`,
        });
      } else if (
        metricsData.dom.totalElements >=
        this.metricsThresholds.dom.elementsWarning
      ) {
        warnings.push({
          type: 'dom_complexity',
          level: 'warning',
          message: `High DOM complexity: ${metricsData.dom.totalElements} elements (threshold: ${this.metricsThresholds.dom.elementsWarning})`,
        });
      }

      if (metricsData.dom.maxDepth >= this.metricsThresholds.dom.depthDanger) {
        warnings.push({
          type: 'dom_complexity',
          level: 'danger',
          message: `Very deep DOM structure: ${metricsData.dom.maxDepth} levels (threshold: ${this.metricsThresholds.dom.depthDanger})`,
        });
      } else if (
        metricsData.dom.maxDepth >= this.metricsThresholds.dom.depthWarning
      ) {
        warnings.push({
          type: 'dom_complexity',
          level: 'warning',
          message: `Deep DOM structure: ${metricsData.dom.maxDepth} levels (threshold: ${this.metricsThresholds.dom.depthWarning})`,
        });
      }

      // Interaction overload warnings
      if (
        metricsData.interaction.clickableElements >=
        this.metricsThresholds.interaction.clickableHigh
      ) {
        warnings.push({
          type: 'interaction_overload',
          level: 'warning',
          message: `High number of clickable elements: ${metricsData.interaction.clickableElements} (threshold: ${this.metricsThresholds.interaction.clickableHigh})`,
        });
      }

      // Layout issue warnings
      if (
        metricsData.layout.highZIndexElements.some(
          (el) =>
            el.zIndex >= this.metricsThresholds.layout.excessiveZIndexThreshold
        )
      ) {
        warnings.push({
          type: 'layout_issue',
          level: 'warning',
          message: `Elements with excessive z-index values detected (>=${this.metricsThresholds.layout.excessiveZIndexThreshold})`,
        });
      }

      // Resource warnings
      if (metricsData.resource.imageCount > 20) {
        warnings.push({
          type: 'resource_heavy',
          level: 'warning',
          message: `High number of images: ${metricsData.resource.imageCount} (may impact loading performance)`,
        });
      }

      const executionTime = Date.now() - startTime;
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
        warnings,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      // Performance: analyzePerformanceMetrics failed
      this.logger.warn('Performance analysis failed:', error);

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
          largeSubtrees: [],
        },
        interactionMetrics: {
          clickableElements: 0,
          formElements: 0,
          disabledElements: 0,
          iframes: 0,
        },
        resourceMetrics: {
          totalRequests: 0,
          totalSize: 0,
          loadTime: 0,
          imageCount: 0,
          estimatedImageSize: 'Unknown',
          scriptTags: 0,
          inlineScripts: 0,
          externalScripts: 0,
          stylesheetCount: 0,
        },
        layoutMetrics: {
          viewportWidth: 0,
          viewportHeight: 0,
          scrollHeight: 0,
          fixedElements: [],
          highZIndexElements: [],
          overflowHiddenElements: 0,
        },
        warnings: [
          {
            type: 'dom_complexity',
            level: 'danger',
            message: `Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
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
      largeFrames: Array<{
        frame: playwright.Frame;
        elementCount: number;
        url: string;
      }>;
      oldFrames: Array<{ frame: playwright.Frame; age: number; url: string }>;
    };
    isDisposed: boolean;
  } {
    if (this.disposed) {
      return {
        frameStats: {
          activeCount: 0,
          totalTracked: 0,
          detachedCount: 0,
          averageElementCount: 0,
        },
        performanceIssues: {
          largeFrames: [],
          oldFrames: [],
        },
        isDisposed: this.disposed,
      };
    }

    const frameStats = this.frameManager.getStatistics();
    const performanceIssues = this.frameManager.findPerformanceIssues();

    return {
      frameStats,
      performanceIssues,
      isDisposed: false,
    };
  }

  /**
   * Manual cleanup of detached frames
   */
  async cleanupFrames(): Promise<void> {
    if (this.disposed) {
      return;
    }
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
      throw new Error(
        `Parallel analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
        largeFrames: Array<{
          frame: playwright.Frame;
          elementCount: number;
          url: string;
        }>;
        oldFrames: Array<{ frame: playwright.Frame; age: number; url: string }>;
      };
      isDisposed: boolean;
    };
    timestamp: number;
  }> {
    const [parallelAnalysis, frameStats] = await Promise.all([
      this.runParallelAnalysis(),
      Promise.resolve(this.getFrameStats()),
    ]);

    return {
      parallelAnalysis,
      frameStats,
      timestamp: Date.now(),
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
      // Evaluating parallel analysis recommendation

      // Quick DOM complexity check
      const elementCount = await page.evaluate(
        () => document.querySelectorAll('*').length
      );
      const iframeCount = await page.evaluate(
        () => document.querySelectorAll('iframe').length
      );
      const formElements = await page.evaluate(
        () =>
          document.querySelectorAll('input, button, select, textarea').length
      );

      const complexity = elementCount + iframeCount * 100 + formElements * 10;
      // Page complexity analysis completed

      if (complexity > 2000) {
        // HIGH complexity detected - parallel analysis strongly recommended
        return {
          recommended: true,
          reason: `High page complexity detected (elements: ${elementCount}, iframes: ${iframeCount})`,
          estimatedBenefit: 'Expected 40-60% performance improvement',
        };
      }
      if (complexity > 1000) {
        // MODERATE complexity detected - parallel analysis recommended
        return {
          recommended: true,
          reason:
            'Moderate complexity - parallel analysis will provide better resource monitoring',
          estimatedBenefit: 'Expected 20-40% performance improvement',
        };
      }
      // LOW complexity detected - sequential analysis sufficient
      return {
        recommended: false,
        reason: 'Low complexity page - sequential analysis sufficient',
        estimatedBenefit: 'Minimal performance difference expected',
      };
    } catch (error) {
      // Error evaluating complexity - defaulting to parallel analysis
      this.logger.warn('Complexity evaluation failed:', error);
      return {
        recommended: true,
        reason:
          'Unable to assess complexity - using parallel analysis as fallback',
        estimatedBenefit: 'Resource monitoring and error handling benefits',
      };
    }
  }
}
