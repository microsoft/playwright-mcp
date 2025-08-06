/**
 * browser_diagnose tool - Comprehensive page diagnostic information
 */

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { expectationSchema } from '../schemas/expectation.js';
import { PageAnalyzer } from '../diagnostics/PageAnalyzer.js';
import { ElementDiscovery, type SearchCriteria } from '../diagnostics/ElementDiscovery.js';
import { DiagnosticLevel } from '../diagnostics/DiagnosticLevel.js';

const diagnoseSchema = z.object({
  searchForElements: z.object({
    text: z.string().optional(),
    role: z.string().optional(),
    tagName: z.string().optional(),
    attributes: z.record(z.string()).optional()
  }).optional().describe('Search for specific elements and include them in the report'),
  includePerformanceMetrics: z.boolean().optional().default(false).describe('Include performance metrics in the report'),
  includeAccessibilityInfo: z.boolean().optional().default(false).describe('Include accessibility information'),
  includeTroubleshootingSuggestions: z.boolean().optional().default(false).describe('Include troubleshooting suggestions'),
  diagnosticLevel: z.enum(['none', 'basic', 'standard', 'detailed', 'full']).optional().default('standard').describe('Level of diagnostic detail: none (no diagnostics), basic (critical only), standard (default), detailed (with metrics), full (all info)'),
  expectation: expectationSchema.optional()
}).describe('Generate a comprehensive diagnostic report of the current page');

export const browserDiagnose = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_diagnose',
    title: 'Diagnose page',
    type: 'readOnly',
    description: 'Generate a comprehensive diagnostic report of the current page including elements, iframes, modal states, and optional performance metrics.',
    inputSchema: diagnoseSchema,
  },
  handle: async (tab, params, response) => {
    const { 
      searchForElements, 
      includePerformanceMetrics, 
      includeAccessibilityInfo, 
      includeTroubleshootingSuggestions,
      diagnosticLevel = 'standard'
    } = params;

    try {
      // Check diagnostic level
      if (diagnosticLevel === 'none') {
        response.addResult('Diagnostics disabled (level: none)');
        return;
      }

      const startTime = Date.now();
      const pageAnalyzer = new PageAnalyzer(tab.page);
      
      // Get basic page analysis
      const diagnosticInfo = await pageAnalyzer.analyzePageStructure();
      
      const reportSections: string[] = [];

      // Basic level: Only critical information
      if (diagnosticLevel === 'basic') {
        reportSections.push(
          '# Basic Diagnostic Report',
          `**URL:** ${tab.page.url()}`,
          '',
          '## Critical Information'
        );
        
        if (diagnosticInfo.iframes.detected) {
          reportSections.push(`- **IFrames detected:** ${diagnosticInfo.iframes.count}`);
        }
        if (diagnosticInfo.modalStates.blockedBy.length > 0) {
          reportSections.push(`- **Active modals:** ${diagnosticInfo.modalStates.blockedBy.join(', ')}`);
        }
        reportSections.push(`- **Interactable elements:** ${diagnosticInfo.elements.totalInteractable}`);
        reportSections.push('');
      } 
      // Standard level and above
      else {
        reportSections.push(
          '# Page Diagnostic Report',
          `**URL:** ${tab.page.url()}`,
          `**Title:** ${await tab.page.title()}`,
          '',
          '## Page Structure Analysis',
          `- **IFrames:** ${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`,
          `- **Accessible iframes:** ${diagnosticInfo.iframes.accessible.length}`,
          `- **Inaccessible iframes:** ${diagnosticInfo.iframes.inaccessible.length}`,
          '',
          `- **Total visible elements:** ${diagnosticInfo.elements.totalVisible}`,
          `- **Total interactable elements:** ${diagnosticInfo.elements.totalInteractable}`,
          `- **Elements missing ARIA:** ${diagnosticInfo.elements.missingAria}`,
          ''
        );
      }

      // Modal state information
      if (diagnosticInfo.modalStates.blockedBy.length > 0) {
        reportSections.push('## Modal States');
        reportSections.push(`- **Active modals:** ${diagnosticInfo.modalStates.blockedBy.join(', ')}`);
        reportSections.push('');
      }

      // Element search results (available in standard level and above)
      if (searchForElements && diagnosticLevel !== 'basic') {
        const elementDiscovery = new ElementDiscovery(tab.page);
        const foundElements = await elementDiscovery.findAlternativeElements({
          originalSelector: '',
          searchCriteria: searchForElements,
          maxResults: 10
        });

        reportSections.push('## Element Search Results');
        if (foundElements.length === 0) {
          reportSections.push('- No elements found matching the search criteria');
        } else {
          reportSections.push(`Found ${foundElements.length} matching elements:`);
          foundElements.forEach((element, index) => {
            reportSections.push(`${index + 1}. **${element.selector}** (${(element.confidence * 100).toFixed(0)}% confidence)`);
            reportSections.push(`   - ${element.reason}`);
          });
        }
        reportSections.push('');
      }

      // Performance metrics (available in detailed and full levels, or when explicitly requested)
      if ((includePerformanceMetrics || diagnosticLevel === 'detailed' || diagnosticLevel === 'full') 
          && diagnosticLevel !== 'basic') {
        const diagnosisTime = Date.now() - startTime;
        
        reportSections.push('## Performance Metrics');
        reportSections.push(`- **Diagnosis execution time:** ${diagnosisTime}ms`);
        
        // Get basic performance metrics
        const performanceMetrics = await tab.page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const paint = performance.getEntriesByType('paint');
          
          return {
            domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
            loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
            firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
            firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime
          };
        });

        if (performanceMetrics.domContentLoaded) {
          reportSections.push(`- **DOM Content Loaded:** ${performanceMetrics.domContentLoaded.toFixed(2)}ms`);
        }
        if (performanceMetrics.loadComplete) {
          reportSections.push(`- **Load Complete:** ${performanceMetrics.loadComplete.toFixed(2)}ms`);
        }
        if (performanceMetrics.firstPaint) {
          reportSections.push(`- **First Paint:** ${performanceMetrics.firstPaint.toFixed(2)}ms`);
        }
        if (performanceMetrics.firstContentfulPaint) {
          reportSections.push(`- **First Contentful Paint:** ${performanceMetrics.firstContentfulPaint.toFixed(2)}ms`);
        }
        reportSections.push('');
      }

      // Accessibility information (available in full level, or when explicitly requested)
      if ((includeAccessibilityInfo || diagnosticLevel === 'full') && diagnosticLevel !== 'basic') {
        reportSections.push('## Accessibility Information');
        reportSections.push(`- **Elements with missing ARIA labels:** ${diagnosticInfo.elements.missingAria}`);
        
        // Get basic accessibility metrics
        const a11yMetrics = await tab.page.evaluate(() => {
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
          const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').length;
          const altTexts = document.querySelectorAll('img[alt]').length;
          const totalImages = document.querySelectorAll('img').length;
          
          return {
            headings,
            landmarks,
            imagesWithAlt: altTexts,
            totalImages
          };
        });

        reportSections.push(`- **Heading elements:** ${a11yMetrics.headings}`);
        reportSections.push(`- **Landmark elements:** ${a11yMetrics.landmarks}`);
        reportSections.push(`- **Images with alt text:** ${a11yMetrics.imagesWithAlt}/${a11yMetrics.totalImages}`);
        reportSections.push('');
      }

      // Troubleshooting suggestions (available in standard level and above, or when explicitly requested)
      if ((includeTroubleshootingSuggestions || diagnosticLevel === 'standard' || diagnosticLevel === 'detailed' || diagnosticLevel === 'full') 
          && diagnosticLevel !== 'basic') {
        reportSections.push('## Troubleshooting Suggestions');
        
        const suggestions: string[] = [];
        
        if (diagnosticInfo.iframes.detected) {
          suggestions.push('Elements might be inside iframes - use frameLocator() for iframe interactions');
        }
        
        if (diagnosticInfo.modalStates.blockedBy.length > 0) {
          suggestions.push(`Active modal states (${diagnosticInfo.modalStates.blockedBy.join(', ')}) may block interactions`);
        }
        
        if (diagnosticInfo.elements.missingAria > 0) {
          suggestions.push(`${diagnosticInfo.elements.missingAria} elements lack proper ARIA attributes - consider using text-based selectors`);
        }
        
        if (diagnosticInfo.elements.totalInteractable < diagnosticInfo.elements.totalVisible * 0.1) {
          suggestions.push('Low ratio of interactable elements - page might still be loading or have CSS issues');
        }
        
        if (suggestions.length === 0) {
          suggestions.push('No obvious issues detected - page appears to be in good state for automation');
        }
        
        suggestions.forEach(suggestion => {
          reportSections.push(`- ${suggestion}`);
        });
        reportSections.push('');
      }

      // Track performance internally
      const totalExecutionTime = Date.now() - startTime;
      if (totalExecutionTime > 300) {
        console.warn(`[Performance] browser_diagnose took ${totalExecutionTime}ms (target: <300ms)`);
      }

      response.addResult(reportSections.join('\n'));

    } catch (error) {
      response.addError(`Error generating diagnostic report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});