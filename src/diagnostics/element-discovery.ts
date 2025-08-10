/**
 * Element discovery for finding alternative elements
 */

import debug from 'debug';
import type * as playwright from 'playwright';
import { DiagnosticBase } from './common/diagnostic-base.js';
import { safeDispose } from './common/error-enrichment-utils.js';
import { SmartHandleBatch } from './smart-handle.js';

const elementDiscoveryDebug = debug('pw:mcp:element-discovery');

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

  constructor(page: playwright.Page | null) {
    super(page, 'ElementDiscovery');
    this.smartHandleBatch = new SmartHandleBatch();
  }

  protected async performDispose(): Promise<void> {
    await safeDispose(this.smartHandleBatch, 'SmartHandleBatch', 'dispose');
  }

  /**
   * Safely dispose an element with enhanced error handling
   * Uses common error enrichment utilities
   */
  private async safeDispose(
    element: playwright.ElementHandle,
    operation: string
  ): Promise<void> {
    await safeDispose(element, 'ElementHandle', operation);
  }

  /**
   * Public interface for safe disposal - used by tests and external components
   */
  async safeDisposePublic(
    element: playwright.ElementHandle | { dispose(): Promise<void> },
    operation: string
  ): Promise<void> {
    if ('dispose' in element) {
      await safeDispose(
        element as { dispose(): Promise<void> },
        'Element',
        operation
      );
    } else {
      await safeDispose(element, 'ElementHandle', operation);
    }
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
        'findAlternativeElements'
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

    await this.processTextSearchStrategies(
      page,
      strategies,
      text,
      alternatives,
      maxResults
    );
    return alternatives;
  }

  private async processTextSearchStrategies(
    page: playwright.Page,
    strategies: string[],
    text: string,
    alternatives: AlternativeElement[],
    maxResults: number
  ): Promise<void> {
    let totalFound = 0;

    const processStrategiesSequentially = async (
      index: number
    ): Promise<void> => {
      if (index >= strategies.length || totalFound >= maxResults) {
        return;
      }

      const selector = strategies[index];
      totalFound = await this.processTextStrategy(
        page,
        selector,
        text,
        alternatives,
        totalFound,
        maxResults
      );

      await processStrategiesSequentially(index + 1);
    };

    await processStrategiesSequentially(0);
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
      const elements = await page.$$(selector);
      return await this.processTextElements(
        elements,
        text,
        alternatives,
        totalFound,
        maxResults
      );
    } catch {
      // Strategy failed for selector - continue with next strategy
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
    // Use reduce for sequential processing without await-in-loop warning
    const result = await elements.reduce(async (previousPromise, element) => {
      const currentFound = await previousPromise;

      if (currentFound >= maxResults) {
        await this.safeDispose(element, `findByText-excess-${currentFound}`);
        return currentFound;
      }

      const elementProcessed = await this.processTextElement(
        element,
        text,
        alternatives,
        currentFound
      );

      return elementProcessed ? currentFound + 1 : currentFound;
    }, Promise.resolve(totalFound));

    return result;
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
        element,
        elementText,
        confidence,
        alternatives,
        totalFound
      );
    } catch (elementError) {
      elementDiscoveryDebug('Element processing failed:', elementError);
      await this.safeDispose(element, `findByText-element-${totalFound}`);
      return false;
    }
  }

  private async extractElementText(
    element: playwright.ElementHandle
  ): Promise<string> {
    const [textContent, value, placeholder, ariaLabel] = await Promise.all([
      element.textContent().then((content) => content ?? ''),
      element.getAttribute('value').then((attr) => attr ?? ''),
      element.getAttribute('placeholder').then((attr) => attr ?? ''),
      element.getAttribute('aria-label').then((attr) => attr ?? ''),
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

    try {
      const elements = await page.$$(`[role="${role}"]`);

      // Use reduce for sequential processing
      const totalFound = await elements.reduce(
        async (previousPromise, element) => {
          const currentFound = await previousPromise;

          if (currentFound >= maxResults) {
            await this.safeDispose(
              element,
              `findByRole-excess-${currentFound}`
            );
            return currentFound;
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
              elementId: `role_${currentFound}`,
            });
            return currentFound + 1;
          } catch (elementError) {
            elementDiscoveryDebug(
              'Element role processing failed:',
              elementError
            );
            await this.safeDispose(
              element,
              `findByRole-element-${currentFound}`
            );
            return currentFound;
          }
        },
        Promise.resolve(0)
      );

      // Also find elements with implicit roles
      if (totalFound < maxResults) {
        const implicitRoleElements = await this.findImplicitRoleElements(
          role,
          maxResults - totalFound
        );
        alternatives.push(...implicitRoleElements);
      }
    } catch {
      // Role search failed - continue with next search strategy
    }

    return alternatives;
  }

  private async findByTagName(
    tagName: string,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const page = this.getPage();
    const alternatives: AlternativeElement[] = [];

    try {
      const elements = await page.$$(tagName);

      // Use reduce for sequential processing
      await elements.reduce(async (previousPromise, element) => {
        const currentFound = await previousPromise;

        if (currentFound >= maxResults) {
          await this.safeDispose(
            element,
            `findByTagName-excess-${currentFound}`
          );
          return currentFound;
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
            elementId: `tag_${currentFound}`,
          });
          return currentFound + 1;
        } catch (elementError) {
          elementDiscoveryDebug('Element tag processing failed:', elementError);
          await this.safeDispose(
            element,
            `findByTagName-element-${currentFound}`
          );
          return currentFound;
        }
      }, Promise.resolve(0));
    } catch {
      // Tag name search failed - continue with next search strategy
    }

    return alternatives;
  }

  private async findByAttributes(
    attributes: Record<string, string>,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const alternatives: AlternativeElement[] = [];

    await this.processAttributeEntries(
      Object.entries(attributes),
      alternatives,
      maxResults
    );

    return alternatives;
  }

  private async processAttributeEntries(
    attributeEntries: [string, string][],
    alternatives: AlternativeElement[],
    maxResults: number
  ): Promise<void> {
    let totalFound = 0;

    const processEntriesSequentially = async (index: number): Promise<void> => {
      if (index >= attributeEntries.length || totalFound >= maxResults) {
        return;
      }

      const [attrName, attrValue] = attributeEntries[index];
      totalFound = await this.processAttributeEntry(
        attrName,
        attrValue,
        alternatives,
        totalFound,
        maxResults
      );

      await processEntriesSequentially(index + 1);
    };

    await processEntriesSequentially(0);
  }

  private async processAttributeEntry(
    attrName: string,
    attrValue: string,
    alternatives: AlternativeElement[],
    totalFound: number,
    maxResults: number
  ): Promise<number> {
    const page = this.getPage();

    try {
      const elements = await page.$$(`[${attrName}="${attrValue}"]`);
      return await this.processAttributeElements(
        elements,
        attrName,
        attrValue,
        alternatives,
        totalFound,
        maxResults
      );
    } catch {
      // Attribute search failed - continue with next search strategy
      return totalFound;
    }
  }

  private async processAttributeElements(
    elements: playwright.ElementHandle[],
    attrName: string,
    attrValue: string,
    alternatives: AlternativeElement[],
    totalFound: number,
    maxResults: number
  ): Promise<number> {
    let currentFound = totalFound;

    const processElementsSequentially = async (
      index: number
    ): Promise<void> => {
      if (index >= elements.length) {
        return;
      }

      const element = elements[index];
      if (currentFound >= maxResults) {
        await this.safeDispose(
          element,
          `findByAttributes-excess-${currentFound}`
        );
        return processElementsSequentially(index + 1);
      }

      const processResult = await this.processAttributeElement(
        element,
        attrName,
        attrValue,
        alternatives,
        currentFound
      );

      if (processResult) {
        currentFound++;
      }

      await processElementsSequentially(index + 1);
    };

    await processElementsSequentially(0);
    return currentFound;
  }

  private async processAttributeElement(
    element: playwright.ElementHandle,
    attrName: string,
    attrValue: string,
    alternatives: AlternativeElement[],
    currentFound: number
  ): Promise<boolean> {
    try {
      const smartElement = this.smartHandleBatch.add(element);

      alternatives.push({
        selector: await this.generateSelector(element),
        confidence: 0.9,
        reason: `attribute match: ${attrName}="${attrValue}"`,
        element: smartElement,
        elementId: `attr_${currentFound}`,
      });

      return true;
    } catch (elementError) {
      elementDiscoveryDebug(
        'Element attribute processing failed:',
        elementError
      );
      await this.safeDispose(
        element,
        `findByAttributes-element-${currentFound}`
      );
      return false;
    }
  }

  private async findImplicitRoleElements(
    role: string,
    maxResults: number
  ): Promise<AlternativeElement[]> {
    const roleTagMapping: Record<string, string[]> = {
      button: ['button', 'input[type="button"]', 'input[type="submit"]'],
      textbox: ['input[type="text"]', 'input[type="email"]', 'textarea'],
      link: ['a[href]'],
      checkbox: ['input[type="checkbox"]'],
      radio: ['input[type="radio"]'],
    };

    const tags = roleTagMapping[role] ?? [];
    const alternatives: AlternativeElement[] = [];

    await this.processImplicitRoleTags(tags, role, alternatives, maxResults);
    return alternatives;
  }

  private async processImplicitRoleTags(
    tags: string[],
    role: string,
    alternatives: AlternativeElement[],
    maxResults: number
  ): Promise<void> {
    let totalFound = 0;

    const processTagsSequentially = async (index: number): Promise<void> => {
      if (index >= tags.length || totalFound >= maxResults) {
        return;
      }

      const tagSelector = tags[index];
      totalFound = await this.processImplicitRoleTag(
        tagSelector,
        role,
        alternatives,
        totalFound,
        maxResults
      );

      await processTagsSequentially(index + 1);
    };

    await processTagsSequentially(0);
  }

  private async processImplicitRoleTag(
    tagSelector: string,
    role: string,
    alternatives: AlternativeElement[],
    totalFound: number,
    maxResults: number
  ): Promise<number> {
    const page = this.getPage();

    try {
      const elements = await page.$$(tagSelector);
      return await this.processImplicitRoleElements(
        elements,
        tagSelector,
        role,
        alternatives,
        totalFound,
        maxResults
      );
    } catch {
      // Implicit role search failed - continue processing
      return totalFound;
    }
  }

  private async processImplicitRoleElements(
    elements: playwright.ElementHandle[],
    tagSelector: string,
    role: string,
    alternatives: AlternativeElement[],
    totalFound: number,
    maxResults: number
  ): Promise<number> {
    let currentFound = totalFound;

    const processElementsSequentially = async (
      index: number
    ): Promise<void> => {
      if (index >= elements.length) {
        return;
      }

      const element = elements[index];
      if (currentFound >= maxResults) {
        await this.safeDispose(
          element,
          `findImplicitRole-excess-${currentFound}`
        );
        return processElementsSequentially(index + 1);
      }

      const processResult = await this.processImplicitRoleElement(
        element,
        tagSelector,
        role,
        alternatives,
        currentFound
      );

      if (processResult) {
        currentFound++;
      }

      await processElementsSequentially(index + 1);
    };

    await processElementsSequentially(0);
    return currentFound;
  }

  private async processImplicitRoleElement(
    element: playwright.ElementHandle,
    tagSelector: string,
    role: string,
    alternatives: AlternativeElement[],
    currentFound: number
  ): Promise<boolean> {
    try {
      const smartElement = this.smartHandleBatch.add(element);

      alternatives.push({
        selector: await this.generateSelector(element),
        confidence: 0.6,
        reason: `implicit role match: "${role}" via ${tagSelector}`,
        element: smartElement,
        elementId: `implicit_${currentFound}`,
      });

      return true;
    } catch (elementError) {
      elementDiscoveryDebug(
        'Implicit role element processing failed:',
        elementError
      );
      await this.safeDispose(
        element,
        `findImplicitRole-element-${currentFound}`
      );
      return false;
    }
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
        const index = siblings.indexOf(el) + 1;
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

    for (let i = 0; i <= a.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
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
