/**
 * Element discovery for finding alternative elements
 */
import { SmartHandleBatch } from './SmartHandle.js';
import { DiagnosticError } from './DiagnosticError.js';
export class ElementDiscovery {
    page;
    isDisposed = false;
    smartHandleBatch;
    maxBatchSize = 100; // Limit for large searches
    constructor(page) {
        this.page = page;
        this.smartHandleBatch = new SmartHandleBatch();
    }
    async dispose() {
        if (this.isDisposed)
            return;
        try {
            await this.smartHandleBatch.disposeAll();
        }
        catch (error) {
            console.warn('[ElementDiscovery] Failed to dispose smart handles:', error);
        }
        this.page = null;
        this.isDisposed = true;
    }
    checkDisposed() {
        if (this.isDisposed) {
            throw new Error('ElementDiscovery has been disposed');
        }
    }
    getPage() {
        this.checkDisposed();
        if (!this.page) {
            throw new Error('Page reference is null');
        }
        return this.page;
    }
    /**
     * Safely dispose an element with enhanced error handling
     * Uses DiagnosticError for structured error reporting
     */
    async safeDispose(element, operation) {
        try {
            await element.dispose();
        }
        catch (error) {
            const diagnosticError = DiagnosticError.from(error instanceof Error ? error : new Error('Unknown dispose error'), 'ElementDiscovery', 'dispose', {
                performanceImpact: 'low',
                suggestions: [
                    'Element dispose failed but processing continues',
                    'This may indicate browser connection issues',
                    'Consider checking browser/page state'
                ]
            });
            console.warn(`[ElementDiscovery:dispose] Failed to dispose element during ${operation}:`, diagnosticError.toJSON());
        }
    }
    async findAlternativeElements(options) {
        const page = this.getPage();
        const { searchCriteria, maxResults = 10 } = options;
        const alternatives = [];
        // Apply batch size limit for large searches
        const effectiveMaxResults = Math.min(maxResults, this.maxBatchSize);
        try {
            // Search by text content
            if (searchCriteria.text) {
                const textMatches = await this.findByText(searchCriteria.text, effectiveMaxResults);
                alternatives.push(...textMatches);
            }
            // Search by ARIA role
            if (searchCriteria.role) {
                const roleMatches = await this.findByRole(searchCriteria.role, effectiveMaxResults);
                alternatives.push(...roleMatches);
            }
            // Search by tag name
            if (searchCriteria.tagName) {
                const tagMatches = await this.findByTagName(searchCriteria.tagName, effectiveMaxResults);
                alternatives.push(...tagMatches);
            }
            // Search by attributes
            if (searchCriteria.attributes) {
                const attributeMatches = await this.findByAttributes(searchCriteria.attributes, effectiveMaxResults);
                alternatives.push(...attributeMatches);
            }
            // Remove duplicates and sort by confidence
            const uniqueAlternatives = this.deduplicateAndSort(alternatives);
            // Limit results
            return uniqueAlternatives.slice(0, effectiveMaxResults);
        }
        catch (error) {
            console.error('[ElementDiscovery] Search failed:', error);
            // Ensure cleanup on error
            await this.smartHandleBatch.disposeAll();
            throw error;
        }
    }
    async findByText(text, maxResults) {
        const page = this.getPage();
        // Use multiple strategies to find text
        const strategies = [
            `text=${text}`,
            `text*=${text}`,
            `[value="${text}"]`,
            `[placeholder="${text}"]`,
            `[aria-label="${text}"]`
        ];
        const alternatives = [];
        let totalFound = 0;
        for (const selector of strategies) {
            if (totalFound >= maxResults)
                break;
            try {
                const elements = await page.$$(selector);
                for (const element of elements) {
                    if (totalFound >= maxResults) {
                        // Dispose excess elements immediately
                        await this.safeDispose(element, `findByText-excess-${totalFound}`);
                        break;
                    }
                    try {
                        const textContent = await element.textContent() || '';
                        const value = await element.getAttribute('value') || '';
                        const placeholder = await element.getAttribute('placeholder') || '';
                        const ariaLabel = await element.getAttribute('aria-label') || '';
                        const allText = [textContent, value, placeholder, ariaLabel].join(' ').trim();
                        // Calculate confidence based on text similarity
                        const confidence = this.calculateTextSimilarity(text, allText);
                        if (confidence > 0.3) {
                            // Wrap element in smart handle for automatic disposal
                            const smartElement = this.smartHandleBatch.add(element);
                            alternatives.push({
                                selector: await this.generateSelector(element),
                                confidence,
                                reason: `text match: "${allText.substring(0, 50).trim()}"`,
                                element: smartElement,
                                elementId: `text_${totalFound}`
                            });
                            totalFound++;
                        }
                        else {
                            // Dispose elements that don't meet confidence threshold
                            await this.safeDispose(element, `findByText-threshold-${totalFound}`);
                        }
                    }
                    catch (elementError) {
                        // Dispose element on error and continue with nested error handling
                        await this.safeDispose(element, `findByText-element-${totalFound}`);
                        continue;
                    }
                }
            }
            catch (error) {
                // Continue with other strategies if one fails
                continue;
            }
        }
        return alternatives;
    }
    async findByRole(role, maxResults) {
        const page = this.getPage();
        const alternatives = [];
        let totalFound = 0;
        try {
            const elements = await page.$$(`[role="${role}"]`);
            for (const element of elements) {
                if (totalFound >= maxResults) {
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
                        elementId: `role_${totalFound}`
                    });
                    totalFound++;
                }
                catch (elementError) {
                    await this.safeDispose(element, `findByRole-element-${totalFound}`);
                    continue;
                }
            }
            // Also find elements with implicit roles
            if (totalFound < maxResults) {
                const implicitRoleElements = await this.findImplicitRoleElements(role, maxResults - totalFound);
                alternatives.push(...implicitRoleElements);
            }
        }
        catch (error) {
            console.warn('[ElementDiscovery] Role search failed:', error);
        }
        return alternatives;
    }
    async findByTagName(tagName, maxResults) {
        const page = this.getPage();
        const alternatives = [];
        let totalFound = 0;
        try {
            const elements = await page.$$(tagName);
            for (const element of elements) {
                if (totalFound >= maxResults) {
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
                        elementId: `tag_${totalFound}`
                    });
                    totalFound++;
                }
                catch (elementError) {
                    await this.safeDispose(element, `findByTagName-element-${totalFound}`);
                    continue;
                }
            }
        }
        catch (error) {
            console.warn('[ElementDiscovery] Tag name search failed:', error);
        }
        return alternatives;
    }
    async findByAttributes(attributes, maxResults) {
        const page = this.getPage();
        const alternatives = [];
        let totalFound = 0;
        for (const [attrName, attrValue] of Object.entries(attributes)) {
            if (totalFound >= maxResults)
                break;
            try {
                const elements = await page.$$(`[${attrName}="${attrValue}"]`);
                for (const element of elements) {
                    if (totalFound >= maxResults) {
                        await this.safeDispose(element, `findByAttributes-excess-${totalFound}`);
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
                            elementId: `attr_${totalFound}`
                        });
                        totalFound++;
                    }
                    catch (elementError) {
                        await this.safeDispose(element, `findByAttributes-element-${totalFound}`);
                        continue;
                    }
                }
            }
            catch (error) {
                // Continue with other attributes if one fails
                continue;
            }
        }
        return alternatives;
    }
    async findImplicitRoleElements(role, maxResults) {
        const page = this.getPage();
        const roleTagMapping = {
            'button': ['button', 'input[type="button"]', 'input[type="submit"]'],
            'textbox': ['input[type="text"]', 'input[type="email"]', 'textarea'],
            'link': ['a[href]'],
            'checkbox': ['input[type="checkbox"]'],
            'radio': ['input[type="radio"]']
        };
        const tags = roleTagMapping[role] || [];
        const alternatives = [];
        let totalFound = 0;
        for (const tagSelector of tags) {
            if (totalFound >= maxResults)
                break;
            try {
                const elements = await page.$$(tagSelector);
                for (const element of elements) {
                    if (totalFound >= maxResults) {
                        await this.safeDispose(element, `findImplicitRole-excess-${totalFound}`);
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
                            elementId: `implicit_${totalFound}`
                        });
                        totalFound++;
                    }
                    catch (elementError) {
                        await this.safeDispose(element, `findImplicitRole-element-${totalFound}`);
                        continue;
                    }
                }
            }
            catch (error) {
                continue;
            }
        }
        return alternatives;
    }
    async generateSelector(element) {
        return await element.evaluate(el => {
            // Generate a unique selector for the element
            if (!(el instanceof Element))
                return 'unknown';
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
            if (id)
                return `${tag}${id}`;
            if (classes)
                return `${tag}${classes}`;
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
    calculateTextSimilarity(target, candidate) {
        const targetLower = target.toLowerCase().trim();
        const candidateLower = candidate.toLowerCase().trim();
        if (targetLower === candidateLower)
            return 1.0;
        if (candidateLower.includes(targetLower))
            return 0.8;
        if (targetLower.includes(candidateLower))
            return 0.6;
        // Simple Levenshtein distance-based similarity
        const distance = this.levenshteinDistance(targetLower, candidateLower);
        const maxLen = Math.max(targetLower.length, candidateLower.length);
        return 1 - (distance / maxLen);
    }
    levenshteinDistance(a, b) {
        if (a.length === 0)
            return b.length;
        if (b.length === 0)
            return a.length;
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
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[b.length][a.length];
    }
    deduplicateAndSort(alternatives) {
        const seen = new Set();
        const unique = [];
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
    getMemoryStats() {
        return {
            activeHandles: this.smartHandleBatch.getActiveCount(),
            isDisposed: this.isDisposed,
            maxBatchSize: this.maxBatchSize
        };
    }
}
