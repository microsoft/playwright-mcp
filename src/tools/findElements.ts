/**
 * browser_find_elements tool - Find elements using multiple search criteria
 */

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { expectationSchema } from '../schemas/expectation.js';
import { ElementDiscovery, type SearchCriteria } from '../diagnostics/ElementDiscovery.js';
import { PageAnalyzer } from '../diagnostics/PageAnalyzer.js';

const findElementsSchema = z.object({
  searchCriteria: z.object({
    text: z.string().optional().describe('Text content to search for'),
    role: z.string().optional().describe('ARIA role to search for'),
    tagName: z.string().optional().describe('HTML tag name to search for'),
    attributes: z.record(z.string()).optional().describe('Attributes to match')
  }).describe('Search criteria for finding elements'),
  maxResults: z.number().optional().default(10).describe('Maximum number of results to return'),
  includeDiagnosticInfo: z.boolean().optional().default(false).describe('Include diagnostic information about the page'),
  expectation: expectationSchema.optional()
}).describe('Find elements using multiple search criteria');

export const browserFindElements = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_find_elements',
    title: 'Find elements',
    type: 'readOnly',
    description: 'Find elements on the page using multiple search criteria such as text, role, tag name, or attributes. Returns matching elements sorted by confidence.',
    inputSchema: findElementsSchema,
  },
  handle: async (tab, params, response) => {
    const { searchCriteria, maxResults, includeDiagnosticInfo } = params;
    const elementDiscovery = new ElementDiscovery(tab.page);
    
    try {
      const startTime = Date.now();
      
      // Find elements using the discovery system
      const alternatives = await elementDiscovery.findAlternativeElements({
        originalSelector: '', // Not used in this context
        searchCriteria,
        maxResults
      });
      
      const searchTime = Date.now() - startTime;

      if (alternatives.length === 0) {
        response.addResult('No elements found matching the specified criteria.');
        return;
      }

      // Format the results
      const resultsText = [
        `Found ${alternatives.length} elements matching the criteria:`,
        ''
      ];

      alternatives.forEach((alt, index) => {
        resultsText.push(`${index + 1}. Selector: ${alt.selector}`);
        resultsText.push(`   Confidence: ${(alt.confidence * 100).toFixed(0)}%`);
        resultsText.push(`   Reason: ${alt.reason}`);
        if (index < alternatives.length - 1) {
          resultsText.push('');
        }
      });

      // Add diagnostic information if requested
      if (includeDiagnosticInfo) {
        const pageAnalyzer = new PageAnalyzer(tab.page);
        const diagnosticInfo = await pageAnalyzer.analyzePageStructure();
        
        resultsText.push('', '### Diagnostic Information');
        resultsText.push(`- Page has ${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`);
        resultsText.push(`- Total visible elements: ${diagnosticInfo.elements.totalVisible}`);
        resultsText.push(`- Total interactable elements: ${diagnosticInfo.elements.totalInteractable}`);
        
        if (diagnosticInfo.modalStates.blockedBy.length > 0) {
          resultsText.push(`- Page blocked by: ${diagnosticInfo.modalStates.blockedBy.join(', ')}`);
        }
      }
      
      // Track performance internally but don't report to agent unless it's critical
      const totalTime = Date.now() - startTime;
      if (totalTime > 300) {
        console.warn(`[Performance] browser_find_elements took ${totalTime}ms (target: <300ms)`);
      }

      response.addResult(resultsText.join('\n'));

    } catch (error) {
      response.addError(`Error finding elements: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});