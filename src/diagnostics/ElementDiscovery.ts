/**
 * Element discovery for finding alternative elements
 */

import type * as playwright from 'playwright';

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
}

export interface ElementDiscoveryOptions {
  originalSelector: string;
  searchCriteria: SearchCriteria;
  maxResults?: number;
}

export class ElementDiscovery {
  constructor(private page: playwright.Page) {}

  async findAlternativeElements(options: ElementDiscoveryOptions): Promise<AlternativeElement[]> {
    const { searchCriteria, maxResults = 10 } = options;
    const alternatives: AlternativeElement[] = [];

    // Search by text content
    if (searchCriteria.text) {
      const textMatches = await this.findByText(searchCriteria.text);
      alternatives.push(...textMatches);
    }

    // Search by ARIA role
    if (searchCriteria.role) {
      const roleMatches = await this.findByRole(searchCriteria.role);
      alternatives.push(...roleMatches);
    }

    // Search by tag name
    if (searchCriteria.tagName) {
      const tagMatches = await this.findByTagName(searchCriteria.tagName);
      alternatives.push(...tagMatches);
    }

    // Search by attributes
    if (searchCriteria.attributes) {
      const attributeMatches = await this.findByAttributes(searchCriteria.attributes);
      alternatives.push(...attributeMatches);
    }

    // Remove duplicates and sort by confidence
    const uniqueAlternatives = this.deduplicateAndSort(alternatives);

    // Limit results
    return uniqueAlternatives.slice(0, maxResults);
  }

  private async findByText(text: string): Promise<AlternativeElement[]> {
    // Use multiple strategies to find text
    const strategies = [
      `text=${text}`,
      `text*=${text}`,
      `[value="${text}"]`,
      `[placeholder="${text}"]`,
      `[aria-label="${text}"]`
    ];

    const alternatives: AlternativeElement[] = [];

    for (const selector of strategies) {
      try {
        const elements = await this.page.$$(selector);
        
        for (const element of elements) {
          const textContent = await element.textContent() || '';
          const value = await element.getAttribute('value') || '';
          const placeholder = await element.getAttribute('placeholder') || '';
          const ariaLabel = await element.getAttribute('aria-label') || '';
          
          const allText = [textContent, value, placeholder, ariaLabel].join(' ').trim();
          
          // Calculate confidence based on text similarity
          const confidence = this.calculateTextSimilarity(text, allText);
          
          if (confidence > 0.3) {
            alternatives.push({
              selector: await this.generateSelector(element),
              confidence,
              reason: `text match: "${allText.substring(0, 50).trim()}"`,
              element
            });
          }
        }
      } catch (error) {
        // Continue with other strategies if one fails
        continue;
      }
    }

    return alternatives;
  }

  private async findByRole(role: string): Promise<AlternativeElement[]> {
    const elements = await this.page.$$(`[role="${role}"]`);
    const alternatives: AlternativeElement[] = [];

    for (const element of elements) {
      const confidence = 0.7; // Base confidence for role match
      
      alternatives.push({
        selector: await this.generateSelector(element),
        confidence,
        reason: `role match: "${role}"`,
        element
      });
    }

    // Also find elements with implicit roles
    const implicitRoleElements = await this.findImplicitRoleElements(role);
    alternatives.push(...implicitRoleElements);

    return alternatives;
  }

  private async findByTagName(tagName: string): Promise<AlternativeElement[]> {
    const elements = await this.page.$$(tagName);
    const alternatives: AlternativeElement[] = [];

    for (const element of elements) {
      const confidence = 0.5; // Base confidence for tag name match
      
      alternatives.push({
        selector: await this.generateSelector(element),
        confidence,
        reason: `tag name match: "${tagName}"`,
        element
      });
    }

    return alternatives;
  }

  private async findByAttributes(attributes: Record<string, string>): Promise<AlternativeElement[]> {
    const alternatives: AlternativeElement[] = [];

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      try {
        const elements = await this.page.$$(`[${attrName}="${attrValue}"]`);
        
        for (const element of elements) {
          alternatives.push({
            selector: await this.generateSelector(element),
            confidence: 0.9, // High confidence for exact attribute match
            reason: `attribute match: ${attrName}="${attrValue}"`,
            element
          });
        }
      } catch (error) {
        // Continue with other attributes if one fails
        continue;
      }
    }

    return alternatives;
  }

  private async findImplicitRoleElements(role: string): Promise<AlternativeElement[]> {
    const roleTagMapping: Record<string, string[]> = {
      'button': ['button', 'input[type="button"]', 'input[type="submit"]'],
      'textbox': ['input[type="text"]', 'input[type="email"]', 'textarea'],
      'link': ['a[href]'],
      'checkbox': ['input[type="checkbox"]'],
      'radio': ['input[type="radio"]']
    };

    const tags = roleTagMapping[role] || [];
    const alternatives: AlternativeElement[] = [];

    for (const tagSelector of tags) {
      const elements = await this.page.$$(tagSelector);
      
      for (const element of elements) {
        alternatives.push({
          selector: await this.generateSelector(element),
          confidence: 0.6,
          reason: `implicit role match: "${role}" via ${tagSelector}`,
          element
        });
      }
    }

    return alternatives;
  }

  private async generateSelector(element: playwright.ElementHandle): Promise<string> {
    return await element.evaluate(el => {
      // Generate a unique selector for the element
      if (!(el instanceof Element)) return 'unknown';
      
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
      
      if (id) return `${tag}${id}`;
      if (classes) return `${tag}${classes}`;
      
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
    
    if (targetLower === candidateLower) return 1.0;
    if (candidateLower.includes(targetLower)) return 0.8;
    if (targetLower.includes(candidateLower)) return 0.6;
    
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(targetLower, candidateLower);
    const maxLen = Math.max(targetLower.length, candidateLower.length);
    return 1 - (distance / maxLen);
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

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
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private deduplicateAndSort(alternatives: AlternativeElement[]): AlternativeElement[] {
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
}