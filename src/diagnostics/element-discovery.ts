/**
 * Element discovery for finding alternative elements
 */

import type * as playwright from 'playwright';
import {
  createDiagnosticLogger,
  DiagnosticBase,
} from './common/diagnostic-base.js';
import { safeDispose } from './common/error-enrichment-utils.js';
import { SmartHandleBatch } from './smart-handle.js';

export interface SearchCriteria {
  text?: string;
  role?: string;
  tagName?: string;
  attributes?: Record<string, string>;
}

export interface AlternativeElement {
  selector: string;
  confidence: number;
  reason: string;
  element?: playwright.ElementHandle;
  elementId?: string; // Resource ID for tracking
}

export interface ElementDiscoveryOptions {
  originalSelector: string;
  searchCriteria: SearchCriteria;
  maxResults?: number;
}

export class ElementDiscovery extends DiagnosticBase {
  private readonly smartHandleBatch: SmartHandleBatch;
  private readonly maxBatchSize = 100; // Limit for large searches
  private readonly logger: ReturnType<typeof createDiagnosticLogger>;

  constructor(page: playwright.Page | null) {
    super(page, 'ElementDiscovery');
    this.smartHandleBatch = new SmartHandleBatch();
    this.logger = createDiagnosticLogger('ElementDiscovery', 'discovery');
  }

  protected async performDispose(): Promise<void> {
    await safeDispose(
      this.smartHandleBatch,
      'SmartHandleBatch',
      'dispose',
      this.logger
    );
  }

  /**
   * Safely dispose an element with enhanced error handling
   * Uses common error enrichment utilities
   */
  private async safeDispose(
    element: playwright.ElementHandle,
    operation: string
  ): Promise<void> {
    await safeDispose(
      element as { dispose: () => Promise<void> },
      'ElementHandle',
      operation,
      this.logger
    );
  }

  async findAlternativeElements(
    options: ElementDiscoveryOptions
  ): Promise<AlternativeElement[]> {
    this.getPage();
    const { searchCriteria, maxResults = 10 } = options;
    const alternatives: AlternativeElement[] = [];

    // Apply batch size limit for large searches
    const effectiveMaxResults = Math.min(maxResults, this.maxBatchSize);

    try {
      // Search by text content
      if (searchCriteria.text) {
        const textMatches = await this.findByText(
          searchCriteria.text,
          effectiveMaxResults
        );
        alternatives.push(...textMatches);
      }

      // Search by ARIA role
      if (searchCriteria.role) {
        const roleMatches = await this.findByRole(
          searchCriteria.role,
          effectiveMaxResults
        );
        alternatives.push(...roleMatches);
      }

      // Search by tag name
      if (searchCriteria.tagName) {
        const tagMatches = await this.findByTagName(
          searchCriteria.tagName,
          effectiveMaxResults
        );
        alternatives.push(...tagMatches);
      }

      // Search by attributes
      if (searchCriteria.attributes) {
        const attributeMatches = await this.findByAttributes(
          searchCriteria.attributes,
          effectiveMaxResults
        );
        alternatives.push(...attributeMatches);
      }

      // Remove duplicates and sort by confidence
      const uniqueAlternatives = this.deduplicateAndSort(alternatives);

      // Limit results
      return uniqueAlternatives.slice(0, effectiveMaxResults);
    } catch (error) {
      // Search failed - ensure cleanup on error
      await safeDispose(
        this.smartHandleBatch,
        'SmartHandleBatch',
        'findAlternativeElements',
        this.logger
      );
      throw error;
    }
  }

  private async findByText(
    text: string,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const page = this.getPage();
    const strategies = this.getTextSearchStrategies(text);
    const alternatives: AlternativeElement[] = [];
    let totalFound = 0;

    for (const selector of strategies) {
      if (totalFound >= maxResults) break;
      
      totalFound = await this.processTextStrategy(
        page, selector, text, alternatives, totalFound, maxResults
      );
    }

    return alternatives;
  }

  private getTextSearchStrategies(text: string): string[] {
    return [
      `text=${text}`,
      `text*=${text}`,
      `[value="${text}"]`,
      `[placeholder="${text}"]`,
      `[aria-label="${text}"]`,
    ];
  }

  private async processTextStrategy(
    page: playwright.Page,
    selector: string,
    text: string,
    alternatives: AlternativeElement[],
    totalFound: number,
    maxResults: number
  ): Promise<number> {
    try {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential execution needed for early termination based on totalFound
      const elements = await page.$$(selector);
      return await this.processTextElements(elements, text, alternatives, totalFound, maxResults);
    } catch (error) {
      this.logger.warn(`Strategy failed for selector '${selector}':`, error);
      return totalFound;
    }
  }

  private async processTextElements(
    elements: playwright.ElementHandle[],
    text: string,
    alternatives: AlternativeElement[],
    totalFound: number,
    maxResults: number
  ): Promise<number> {
    let currentFound = totalFound;

    for (const element of elements) {
      if (currentFound >= maxResults) {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential disposal is necessary for resource cleanup
        await this.safeDispose(element, `findByText-excess-${currentFound}`);
        break;
      }

      const elementProcessed = await this.processTextElement(
        element, text, alternatives, currentFound
      );
      if (elementProcessed) currentFound++;
    }

    return currentFound;
  }

  private async processTextElement(
    element: playwright.ElementHandle,
    text: string,
    alternatives: AlternativeElement[],
    totalFound: number
  ): Promise<boolean> {
    try {
      const elementText = await this.extractElementText(element);
      const confidence = this.calculateTextSimilarity(text, elementText);

      return await this.handleTextMatchResult(
        element, elementText, confidence, alternatives, totalFound
      );
    } catch (_elementError) {
      await this.safeDispose(element, `findByText-element-${totalFound}`);
      return false;
    }
  }

  private async extractElementText(element: playwright.ElementHandle): Promise<string> {
    const [textContent, value, placeholder, ariaLabel] = await Promise.all([
      element.textContent().then((content) => content || ''),
      element.getAttribute('value').then((attr) => attr || ''),
      element.getAttribute('placeholder').then((attr) => attr || ''),
      element.getAttribute('aria-label').then((attr) => attr || ''),
    ]);

    return [textContent, value, placeholder, ariaLabel].join(' ').trim();
  }

  private async handleTextMatchResult(
    element: playwright.ElementHandle,
    elementText: string,
    confidence: number,
    alternatives: AlternativeElement[],
    totalFound: number
  ): Promise<boolean> {
    if (confidence > 0.3) {
      const smartElement = this.smartHandleBatch.add(element);
      alternatives.push({
        selector: await this.generateSelector(element),
        confidence,
        reason: `text match: "${elementText.substring(0, 50).trim()}"`,
        element: smartElement,
        elementId: `text_${totalFound}`,
      });
      return true;
    }
    
    await this.safeDispose(element, `findByText-threshold-${totalFound}`);
    return false;
  }

  private async findByRole(
    role: string,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const page = this.getPage();
    const alternatives: AlternativeElement[] = [];
    let totalFound = 0;

    try {
      const elements = await page.$$(`[role="${role}"]`);

      for (const element of elements) {
        if (totalFound >= maxResults) {
          // biome-ignore lint/nursery/noAwaitInLoop: Sequential disposal is necessary for resource cleanup
          await this.safeDispose(element, `findByRole-excess-${totalFound}`);
          break;
        }

        try {
          const confidence = 0.7; // Base confidence for role match

          // Wrap element in smart handle
          const smartElement = this.smartHandleBatch.add(element);

          alternatives.push({
            selector: await this.generateSelector(element),
            confidence,
            reason: `role match: "${role}"`,
            element: smartElement,
            elementId: `role_${totalFound}`,
          });
          totalFound++;
        } catch (_elementError) {
          await this.safeDispose(element, `findByRole-element-${totalFound}`);
        }
      }

      // Also find elements with implicit roles
      if (totalFound < maxResults) {
        const implicitRoleElements = await this.findImplicitRoleElements(
          role,
          maxResults - totalFound
        );
        alternatives.push(...implicitRoleElements);
      }
    } catch (error) {
      // Role search failed - continue with processing
      this.logger.warn(`Role search failed for role '${role}':`, error);
    }

    return alternatives;
  }

  private async findByTagName(
    tagName: string,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const page = this.getPage();
    const alternatives: AlternativeElement[] = [];
    let totalFound = 0;

    try {
      const elements = await page.$$(tagName);

      for (const element of elements) {
        if (totalFound >= maxResults) {
          // biome-ignore lint/nursery/noAwaitInLoop: Sequential disposal is necessary for resource cleanup
          await this.safeDispose(element, `findByTagName-excess-${totalFound}`);
          break;
        }

        try {
          const confidence = 0.5; // Base confidence for tag name match

          // Wrap element in smart handle
          const smartElement = this.smartHandleBatch.add(element);

          alternatives.push({
            selector: await this.generateSelector(element),
            confidence,
            reason: `tag name match: "${tagName}"`,
            element: smartElement,
            elementId: `tag_${totalFound}`,
          });
          totalFound++;
        } catch (_elementError) {
          await this.safeDispose(
            element,
            `findByTagName-element-${totalFound}`
          );
        }
      }
    } catch (error) {
      // Tag name search failed - continue with processing
      this.logger.warn(`Tag search failed for tag '${tagName}':`, error);
    }

    return alternatives;
  }

  private async findByAttributes(
    attributes: Record<string, string>,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const page = this.getPage();
    const alternatives: AlternativeElement[] = [];
    let totalFound = 0;

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      if (totalFound >= maxResults) {
        break;
      }

      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential execution needed for early termination based on totalFound
        const elements = await page.$$(`[${attrName}="${attrValue}"]`);

        for (const element of elements) {
          if (totalFound >= maxResults) {
            // biome-ignore lint/nursery/noAwaitInLoop: Sequential disposal is necessary for resource cleanup
            await this.safeDispose(
              element,
              `findByAttributes-excess-${totalFound}`
            );
            break;
          }

          try {
            // Wrap element in smart handle
            const smartElement = this.smartHandleBatch.add(element);

            alternatives.push({
              selector: await this.generateSelector(element),
              confidence: 0.9, // High confidence for exact attribute match
              reason: `attribute match: ${attrName}="${attrValue}"`,
              element: smartElement,
              elementId: `attr_${totalFound}`,
            });
            totalFound++;
          } catch (_elementError) {
            await this.safeDispose(
              element,
              `findByAttributes-element-${totalFound}`
            );
          }
        }
      } catch (error) {
        // Continue with other attributes if one fails
        this.logger.warn(
          `Attribute search failed for ${attrName}='${attrValue}':`,
          error
        );
      }
    }

    return alternatives;
  }

  private async findImplicitRoleElements(
    role: string,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const page = this.getPage();
    const roleTagMapping: Record<string, string[]> = {
      button: ['button', 'input[type="button"]', 'input[type="submit"]'],
      textbox: ['input[type="text"]', 'input[type="email"]', 'textarea'],
      link: ['a[href]'],
      checkbox: ['input[type="checkbox"]'],
      radio: ['input[type="radio"]'],
    };

    const tags = roleTagMapping[role] || [];
    const alternatives: AlternativeElement[] = [];
    let totalFound = 0;

    for (const tagSelector of tags) {
      if (totalFound >= maxResults) {
        break;
      }

      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential execution needed for early termination based on totalFound
        const elements = await page.$$(tagSelector);

        for (const element of elements) {
          if (totalFound >= maxResults) {
            // biome-ignore lint/nursery/noAwaitInLoop: Sequential disposal is necessary for resource cleanup
            await this.safeDispose(
              element,
              `findImplicitRole-excess-${totalFound}`
            );
            break;
          }

          try {
            // Wrap element in smart handle
            const smartElement = this.smartHandleBatch.add(element);

            alternatives.push({
              selector: await this.generateSelector(element),
              confidence: 0.6,
              reason: `implicit role match: "${role}" via ${tagSelector}`,
              element: smartElement,
              elementId: `implicit_${totalFound}`,
            });
            totalFound++;
          } catch (_elementError) {
            await this.safeDispose(
              element,
              `findImplicitRole-element-${totalFound}`
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Implicit role search failed for '${tagSelector}':`,
          error
        );
      }
    }

    return alternatives;
  }

  private async generateSelector(
    element: playwright.ElementHandle
  ): Promise<string> {
    return await element.evaluate((el) => {
      // Generate a unique selector for the element
      if (!(el instanceof Element)) {
        return 'unknown';
      }

      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className
        ? `.${el.className.split(' ').join('.')}`
        : '';

      if (id) {
        return `${tag}${id}`;
      }
      if (classes) {
        return `${tag}${classes}`;
      }

      // Fallback to nth-child selector
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el as Element) + 1;
        return `${parent.tagName.toLowerCase()} > ${tag}:nth-child(${index})`;
      }

      return tag;
    });
  }

  private calculateTextSimilarity(target: string, candidate: string): number {
    const targetLower = target.toLowerCase().trim();
    const candidateLower = candidate.toLowerCase().trim();

    if (targetLower === candidateLower) {
      return 1.0;
    }
    if (candidateLower.includes(targetLower)) {
      return 0.8;
    }
    if (targetLower.includes(candidateLower)) {
      return 0.6;
    }

    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(targetLower, candidateLower);
    const maxLen = Math.max(targetLower.length, candidateLower.length);
    return 1 - distance / maxLen;
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) {
      return b.length;
    }
    if (b.length === 0) {
      return a.length;
    }

    const matrix = new Array(b.length + 1)
      .fill(null)
      .map(() => new Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private deduplicateAndSort(
    alternatives: AlternativeElement[]
  ): AlternativeElement[] {
    const seen = new Set<string>();
    const unique: AlternativeElement[] = [];

    for (const alt of alternatives) {
      if (!seen.has(alt.selector)) {
        seen.add(alt.selector);
        unique.push(alt);
      }
    }

    // Sort by confidence descending
    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get statistics about current memory usage
   */
  getMemoryStats(): {
    activeHandles: number;
    isDisposed: boolean;
    maxBatchSize: number;
  } {
    return {
      activeHandles: this.smartHandleBatch.getActiveCount(),
      isDisposed: this.disposed,
      maxBatchSize: this.maxBatchSize,
    };
  }
}
