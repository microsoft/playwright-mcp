/**
 * browser_find_elements tool - Find elements using multiple search criteria
 */

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { expectationSchema } from '../schemas/expectation.js';
import { ElementDiscovery  } from '../diagnostics/ElementDiscovery.js';
import { PageAnalyzer } from '../diagnostics/PageAnalyzer.js';
import { UnifiedDiagnosticSystem } from '../diagnostics/UnifiedSystem.js';

import type { SmartConfig } from '../diagnostics/SmartConfig.js';

const findElementsSchema = z.object({
  searchCriteria: z.object({
    text: z.string().optional().describe('Text content to search for'),
    role: z.string().optional().describe('ARIA role to search for'),
    tagName: z.string().optional().describe('HTML tag name to search for'),
    attributes: z.record(z.string()).optional().describe('Attributes to match')
  }).describe('Search criteria for finding elements'),
  maxResults: z.number().optional().default(10).describe('Maximum number of results to return'),
  includeDiagnosticInfo: z.boolean().optional().default(false).describe('Include diagnostic information about the page'),
  useUnifiedSystem: z.boolean().optional().default(true).describe('Use unified diagnostic system for enhanced error handling'),
  enableEnhancedDiscovery: z.boolean().optional().default(true).describe('Enable enhanced element discovery with contextual suggestions'),
  performanceThreshold: z.number().optional().default(500).describe('Performance threshold in milliseconds for element discovery'),
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
    const {
      searchCriteria,
      maxResults,
      includeDiagnosticInfo,
      useUnifiedSystem = true,
      enableEnhancedDiscovery = true,
      performanceThreshold = 500
    } = params;

    let unifiedSystem: UnifiedDiagnosticSystem | null = null;
    let elementDiscovery: ElementDiscovery | null = null;

    try {
      let alternatives: any[] = [];
      let operationResult: any;

      if (useUnifiedSystem) {
        // Configure unified system with element discovery optimizations
        const configOverrides: Partial<SmartConfig> = {
          features: {
            enableParallelAnalysis: true,
            enableSmartHandleManagement: true,
            enableAdvancedElementDiscovery: enableEnhancedDiscovery,
            enableResourceLeakDetection: true,
            enableRealTimeMonitoring: false
          },
          performance: {
            enableMetricsCollection: true,
            enableResourceMonitoring: true,
            enablePerformanceWarnings: true,
            autoOptimization: true,
            thresholds: {
              executionTime: {
                elementDiscovery: performanceThreshold,
                pageAnalysis: 1000,
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
            }
          }
        };

        unifiedSystem = UnifiedDiagnosticSystem.getInstance(tab.page, configOverrides);

        // Use unified system for element discovery with enhanced error handling
        operationResult = await unifiedSystem.findAlternativeElements({
          originalSelector: '', // Not used in this context
          searchCriteria,
          maxResults
        });

        if (operationResult.success) {
          alternatives = operationResult.data;
        } else {
          // Handle enhanced error from unified system
          const errorInfo = operationResult.error;
          let errorMessage = `Element discovery failed: ${errorInfo?.message || 'Unknown error'}`;

          if (errorInfo?.suggestions && errorInfo.suggestions.length > 0) {
            errorMessage += '\n\nSuggestions:';
            errorInfo.suggestions.forEach((suggestion: string) => {
              errorMessage += `\n- ${suggestion}`;
            });
          }

          response.addError(errorMessage);
          return;
        }

        // Used unified system for element discovery
      } else {
        // Legacy element discovery
        elementDiscovery = new ElementDiscovery(tab.page);
        alternatives = await elementDiscovery.findAlternativeElements({
          originalSelector: '', // Not used in this context
          searchCriteria,
          maxResults
        });

        // Used legacy element discovery
      }


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
        if (index < alternatives.length - 1)
          resultsText.push('');

      });

      // Add diagnostic information if requested
      if (includeDiagnosticInfo) {
        if (unifiedSystem) {
          // Use unified system for diagnostic information
          const diagResult = await unifiedSystem.analyzePageStructure();
          if (diagResult.success) {
            const diagnosticInfo = diagResult.data;

            resultsText.push('', '### Enhanced Diagnostic Information');
            resultsText.push(`- Analysis time: ${diagResult.executionTime}ms`);

            if (diagResult.memoryUsage)
              resultsText.push(`- Memory usage: ${(diagResult.memoryUsage / 1024 / 1024).toFixed(2)}MB`);


            if ('structureAnalysis' in diagnosticInfo) {
              // Parallel analysis result
              const structure = diagnosticInfo.structureAnalysis;
              resultsText.push(`- Page has ${structure.iframes.count} iframes detected: ${structure.iframes.detected}`);
              resultsText.push(`- Total visible elements: ${structure.elements.totalVisible}`);
              resultsText.push(`- Total interactable elements: ${structure.elements.totalInteractable}`);

              if (structure.modalStates.blockedBy.length > 0)
                resultsText.push(`- Page blocked by: ${structure.modalStates.blockedBy.join(', ')}`);

            } else {
              // Standard analysis result
              resultsText.push(`- Page has ${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`);
              resultsText.push(`- Total visible elements: ${diagnosticInfo.elements.totalVisible}`);
              resultsText.push(`- Total interactable elements: ${diagnosticInfo.elements.totalInteractable}`);

              if (diagnosticInfo.modalStates.blockedBy.length > 0)
                resultsText.push(`- Page blocked by: ${diagnosticInfo.modalStates.blockedBy.join(', ')}`);

            }
          } else {
            resultsText.push('', '### Diagnostic Information');
            resultsText.push(`- Error getting diagnostic information: ${diagResult.error?.message || 'Unknown error'}`);
          }
        } else {
          // Legacy diagnostic information
          const pageAnalyzer = new PageAnalyzer(tab.page);
          try {
            const diagnosticInfo = await pageAnalyzer.analyzePageStructure();

            resultsText.push('', '### Diagnostic Information');
            resultsText.push(`- Page has ${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`);
            resultsText.push(`- Total visible elements: ${diagnosticInfo.elements.totalVisible}`);
            resultsText.push(`- Total interactable elements: ${diagnosticInfo.elements.totalInteractable}`);

            if (diagnosticInfo.modalStates.blockedBy.length > 0)
              resultsText.push(`- Page blocked by: ${diagnosticInfo.modalStates.blockedBy.join(', ')}`);

          } finally {
            await pageAnalyzer.dispose();
          }
        }
      }

      // Add unified system performance information if available
      if (useUnifiedSystem && operationResult && enableEnhancedDiscovery) {
        resultsText.push('');
        resultsText.push('### Enhanced Discovery Information');
        resultsText.push(`- Discovery execution time: ${operationResult.executionTime}ms`);

        if (operationResult.memoryUsage)
          resultsText.push(`- Memory usage: ${(operationResult.memoryUsage / 1024 / 1024).toFixed(2)}MB`);


        if (operationResult.executionTime > performanceThreshold)
          resultsText.push(`- ⚠️ Discovery exceeded performance threshold (${performanceThreshold}ms)`);
        else
          resultsText.push(`- ✅ Discovery within performance threshold`);

      }

      // Track performance internally but don't report to agent unless it's critical
      response.addResult(resultsText.join('\n'));

    } catch (error) {
      response.addError(`Error finding elements: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Cleanup: unified system manages its own lifecycle, only dispose legacy elementDiscovery
      if (elementDiscovery)
        await elementDiscovery.dispose();

    }
  }
});
