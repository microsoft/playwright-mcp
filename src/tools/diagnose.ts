/**
 * browser_diagnose tool - Comprehensive page diagnostic information
 */

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { expectationSchema } from '../schemas/expectation.js';
import { PageAnalyzer } from '../diagnostics/PageAnalyzer.js';
import { ElementDiscovery, type SearchCriteria } from '../diagnostics/ElementDiscovery.js';
import { DiagnosticLevel } from '../diagnostics/DiagnosticLevel.js';
import { UnifiedDiagnosticSystem } from '../diagnostics/UnifiedSystem.js';
import { SmartConfigManager, type SmartConfig } from '../diagnostics/SmartConfig.js';

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
  useParallelAnalysis: z.boolean().optional().default(false).describe('Use Phase 2 parallel analysis for improved performance and resource monitoring'),
  useUnifiedSystem: z.boolean().optional().default(true).describe('Use Phase 3 unified diagnostic system with enhanced error handling and monitoring'),
  configOverrides: z.object({
    enableResourceMonitoring: z.boolean().optional(),
    enableErrorEnrichment: z.boolean().optional(),
    enableAdaptiveThresholds: z.boolean().optional(),
    performanceThresholds: z.object({
      pageAnalysis: z.number().optional(),
      elementDiscovery: z.number().optional(),
      resourceMonitoring: z.number().optional()
    }).optional()
  }).optional().describe('Runtime configuration overrides for diagnostic system'),
  includeSystemStats: z.boolean().optional().default(false).describe('Include unified system statistics and health information'),
  expectation: expectationSchema.optional()
}).describe('Generate a comprehensive diagnostic report of the current page');

export const browserDiagnose = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_diagnose',
    title: 'Diagnose page',
    type: 'readOnly',
    description: 'Analyze page complexity and performance characteristics. Reports on: iframe count, DOM size, modal states, element statistics. Use for: debugging slow pages, understanding page structure, or monitoring page complexity.',
    inputSchema: diagnoseSchema,
  },
  handle: async (tab, params, response) => {
    const { 
      searchForElements, 
      includePerformanceMetrics, 
      includeAccessibilityInfo, 
      includeTroubleshootingSuggestions,
      diagnosticLevel = 'standard',
      useParallelAnalysis = false,
      useUnifiedSystem = true,
      configOverrides,
      includeSystemStats = false
    } = params;

    try {
      // Check diagnostic level
      if (diagnosticLevel === 'none') {
        response.addResult('Diagnostics disabled (level: none)');
        return;
      }

      const startTime = Date.now();
      let unifiedSystem: UnifiedDiagnosticSystem | null = null;
      let pageAnalyzer: PageAnalyzer;

      // Initialize unified system or fallback to direct PageAnalyzer
      if (useUnifiedSystem) {
        // Apply configuration overrides if provided
        const configUpdates: Partial<SmartConfig> = {};
        
        if (configOverrides) {
          if (configOverrides.enableResourceMonitoring !== undefined) {
            configUpdates.features = { 
              enableParallelAnalysis: true,
              enableSmartHandleManagement: true,
              enableAdvancedElementDiscovery: true,
              enableResourceLeakDetection: configOverrides.enableResourceMonitoring,
              enableRealTimeMonitoring: false
            };
          }
          
          if (configOverrides.enableErrorEnrichment !== undefined) {
            configUpdates.errorHandling = {
              enableErrorEnrichment: configOverrides.enableErrorEnrichment,
              enableContextualSuggestions: true,
              logLevel: 'warn' as const,
              maxErrorHistory: 100,
              enablePerformanceErrorDetection: true
            };
          }
          
          if (configOverrides.enableAdaptiveThresholds !== undefined) {
            configUpdates.runtime = {
              enableAdaptiveThresholds: configOverrides.enableAdaptiveThresholds,
              enableAutoTuning: false,
              statsCollectionEnabled: true
            };
          }
          
          if (configOverrides.performanceThresholds) {
            configUpdates.performance = {
              enableMetricsCollection: true,
              enableResourceMonitoring: true,
              enablePerformanceWarnings: true,
              autoOptimization: true,
              thresholds: {
                executionTime: {
                  pageAnalysis: configOverrides.performanceThresholds.pageAnalysis || 1000,
                  elementDiscovery: configOverrides.performanceThresholds.elementDiscovery || 500,
                  resourceMonitoring: configOverrides.performanceThresholds.resourceMonitoring || 200,
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
            };
          }
        }
        
        unifiedSystem = UnifiedDiagnosticSystem.getInstance(tab.page, configUpdates);
        console.info('[browser_diagnose] Using unified diagnostic system');
      } else {
        pageAnalyzer = new PageAnalyzer(tab.page);
        console.info('[browser_diagnose] Using legacy PageAnalyzer');
      }
      
      try {
        const reportSections: string[] = [];
        
        // Execute analysis using unified system or legacy approach
        let diagnosticInfo: any;
        let performanceMetrics: any;
        let resourceUsageInfo: any;
        let systemHealthInfo: any;
        
        if (unifiedSystem) {
          // Use unified system for enhanced analysis with error handling
          reportSections.push(
            '# Unified Diagnostic System Report',
            `**Unified System Status:** Active with enhanced error handling and monitoring`,
            `**Configuration:** ${configOverrides ? 'Custom overrides applied' : 'Default settings'}`,
            ''
          );
          
          // Execute page structure analysis through unified system
          const structureResult = await unifiedSystem.analyzePageStructure();
          if (structureResult.success) {
            diagnosticInfo = structureResult.data;
            
            if ('structureAnalysis' in diagnosticInfo) {
              // Parallel analysis result
              performanceMetrics = diagnosticInfo.performanceMetrics;
              resourceUsageInfo = diagnosticInfo.resourceUsage;
              diagnosticInfo = diagnosticInfo.structureAnalysis;
              
              reportSections.push(`**Analysis Type:** Enhanced Parallel Analysis (${structureResult.executionTime}ms)`);
            } else {
              // Standard analysis result
              reportSections.push(`**Analysis Type:** Standard Analysis (${structureResult.executionTime}ms)`);
            }
            
            if (structureResult.memoryUsage) {
              reportSections.push(`**Memory Usage:** ${(structureResult.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
            }
          } else {
            reportSections.push(`**Analysis Error:** ${structureResult.error?.message || 'Unknown error'}`);
            if (structureResult.error?.suggestions && structureResult.error.suggestions.length > 0) {
              reportSections.push('**Error Suggestions:**');
              structureResult.error.suggestions.forEach(suggestion => {
                reportSections.push(`- ${suggestion}`);
              });
            }
            // Fallback to basic error case
            response.addError(`Unified system analysis failed: ${structureResult.error?.message || 'Unknown error'}`);
            return;
          }
          
          // Get system health information if requested
          if (includeSystemStats) {
            systemHealthInfo = await unifiedSystem.performHealthCheck();
            const systemStats = unifiedSystem.getSystemStats();
            
            reportSections.push('');
            reportSections.push('## Unified System Health');
            reportSections.push(`- **System Status:** ${systemHealthInfo.status}`);
            reportSections.push(`- **Total Operations:** ${systemStats.performanceMetrics.totalOperations}`);
            reportSections.push(`- **Success Rate:** ${(systemStats.performanceMetrics.successRate * 100).toFixed(1)}%`);
            reportSections.push(`- **Active Handles:** ${systemStats.resourceUsage.currentHandles}`);
            reportSections.push(`- **Total Errors:** ${Object.values(systemStats.errorCount).reduce((sum, count) => sum + count, 0)}`);
            
            if (systemHealthInfo.issues.length > 0) {
              reportSections.push('');
              reportSections.push('### System Issues');
              systemHealthInfo.issues.forEach((issue: string) => {
                reportSections.push(`- ⚠️ ${issue}`);
              });
            }
            
            if (systemHealthInfo.recommendations.length > 0) {
              reportSections.push('');
              reportSections.push('### System Recommendations');
              systemHealthInfo.recommendations.forEach((rec: string) => {
                reportSections.push(`- 💡 ${rec}`);
              });
            }
            
            reportSections.push('');
          }
          
        } else if (useParallelAnalysis) {
          // Legacy parallel analysis
          const parallelRecommendation = await pageAnalyzer!.shouldUseParallelAnalysis();
          
          if (parallelRecommendation.recommended || useParallelAnalysis) {
            const parallelResult = await pageAnalyzer!.runParallelAnalysis();
            diagnosticInfo = parallelResult.structureAnalysis;
            performanceMetrics = parallelResult.performanceMetrics;
            resourceUsageInfo = parallelResult.resourceUsage;
            
            // Add parallel analysis info to report
            reportSections.push(
              '# Enhanced Diagnostic Report (Parallel Analysis)',
              `**Parallel Analysis Execution Time:** ${parallelResult.executionTime}ms`,
              `**Resource Monitoring:** ${resourceUsageInfo ? 'Enabled' : 'Disabled'}`,
              ''
            );
            
            if (parallelResult.errors.length > 0) {
              reportSections.push('## Analysis Warnings');
              parallelResult.errors.forEach(error => {
                reportSections.push(`- **${error.step}:** ${error.error}`);
              });
              reportSections.push('');
            }
          } else {
            // Fallback to standard analysis
            diagnosticInfo = await pageAnalyzer!.analyzePageStructure();
            reportSections.push(
              '# Standard Diagnostic Report',
              `**Parallel Analysis:** Not recommended - ${parallelRecommendation.reason}`,
              ''
            );
          }
        } else {
          // Standard analysis (legacy mode)
          diagnosticInfo = await pageAnalyzer!.analyzePageStructure();
        }

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
        
        try {
          // Get comprehensive performance metrics - use parallel analysis data if available
          const comprehensiveMetrics = performanceMetrics || await pageAnalyzer!.analyzePerformanceMetrics();
          
          // DOM Complexity Metrics
          reportSections.push('');
          reportSections.push('### DOM Complexity');
          reportSections.push(`- **Total DOM elements:** ${comprehensiveMetrics.domMetrics.totalElements}`);
          reportSections.push(`- **Max DOM depth:** ${comprehensiveMetrics.domMetrics.maxDepth} levels`);
          
          if (comprehensiveMetrics.domMetrics.largeSubtrees.length > 0) {
            reportSections.push(`- **Large subtrees detected:** ${comprehensiveMetrics.domMetrics.largeSubtrees.length}`);
            comprehensiveMetrics.domMetrics.largeSubtrees.slice(0, 3).forEach((subtree: any, index: number) => {
              reportSections.push(`  ${index + 1}. **${subtree.selector}**: ${subtree.elementCount} elements (${subtree.description})`);
            });
          }
          
          // Interaction Metrics
          reportSections.push('');
          reportSections.push('### Interaction Elements');
          reportSections.push(`- **Clickable elements:** ${comprehensiveMetrics.interactionMetrics.clickableElements}`);
          reportSections.push(`- **Form elements:** ${comprehensiveMetrics.interactionMetrics.formElements}`);
          reportSections.push(`- **Disabled elements:** ${comprehensiveMetrics.interactionMetrics.disabledElements}`);
          
          // Resource Metrics
          reportSections.push('');
          reportSections.push('### Resource Load');
          reportSections.push(`- **Images:** ${comprehensiveMetrics.resourceMetrics.imageCount} (${comprehensiveMetrics.resourceMetrics.estimatedImageSize})`);
          reportSections.push(`- **Script tags:** ${comprehensiveMetrics.resourceMetrics.scriptTags} (${comprehensiveMetrics.resourceMetrics.externalScripts} external, ${comprehensiveMetrics.resourceMetrics.inlineScripts} inline)`);
          reportSections.push(`- **Stylesheets:** ${comprehensiveMetrics.resourceMetrics.stylesheetCount}`);
          
          // Layout Metrics (available in full level only)
          if (diagnosticLevel === 'full') {
            reportSections.push('');
            reportSections.push('### Layout Analysis');
            reportSections.push(`- **Fixed position elements:** ${comprehensiveMetrics.layoutMetrics.fixedElements.length}`);
            reportSections.push(`- **High z-index elements:** ${comprehensiveMetrics.layoutMetrics.highZIndexElements.length}`);
            reportSections.push(`- **Overflow hidden elements:** ${comprehensiveMetrics.layoutMetrics.overflowHiddenElements}`);
            
            if (comprehensiveMetrics.layoutMetrics.fixedElements.length > 0) {
              reportSections.push('');
              reportSections.push('**Fixed Elements:**');
              comprehensiveMetrics.layoutMetrics.fixedElements.slice(0, 5).forEach((element: any, index: number) => {
                reportSections.push(`${index + 1}. **${element.selector}**: ${element.purpose} (z-index: ${element.zIndex})`);
              });
            }
            
            if (comprehensiveMetrics.layoutMetrics.highZIndexElements.length > 0) {
              reportSections.push('');
              reportSections.push('**High Z-Index Elements:**');
              comprehensiveMetrics.layoutMetrics.highZIndexElements.slice(0, 5).forEach((element: any, index: number) => {
                reportSections.push(`${index + 1}. **${element.selector}**: z-index ${element.zIndex} (${element.description})`);
              });
            }
          }
          
          // Warnings
          if (comprehensiveMetrics.warnings.length > 0) {
            reportSections.push('');
            reportSections.push('### Performance Warnings');
            comprehensiveMetrics.warnings.forEach((warning: any) => {
              const icon = warning.level === 'danger' ? '🚨' : '⚠️';
              reportSections.push(`- ${icon} **${warning.type}**: ${warning.message}`);
            });
          }
          
        } catch (error) {
          reportSections.push('');
          reportSections.push(`- **Error analyzing performance metrics:** ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Get basic browser performance metrics as fallback/additional info
        try {
          const browserMetrics = await tab.page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');
            
            return {
              domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
              loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
              firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
              firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime
            };
          });

          if (browserMetrics.domContentLoaded || browserMetrics.loadComplete || browserMetrics.firstPaint || browserMetrics.firstContentfulPaint) {
            reportSections.push('');
            reportSections.push('### Browser Performance Timing');
            if (browserMetrics.domContentLoaded) {
              reportSections.push(`- **DOM Content Loaded:** ${browserMetrics.domContentLoaded.toFixed(2)}ms`);
            }
            if (browserMetrics.loadComplete) {
              reportSections.push(`- **Load Complete:** ${browserMetrics.loadComplete.toFixed(2)}ms`);
            }
            if (browserMetrics.firstPaint) {
              reportSections.push(`- **First Paint:** ${browserMetrics.firstPaint.toFixed(2)}ms`);
            }
            if (browserMetrics.firstContentfulPaint) {
              reportSections.push(`- **First Contentful Paint:** ${browserMetrics.firstContentfulPaint.toFixed(2)}ms`);
            }
          }
        } catch (error) {
          reportSections.push('');
          reportSections.push(`- **Browser timing metrics unavailable:** ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Phase 2: Add resource usage information from parallel analysis
        if (resourceUsageInfo && useParallelAnalysis) {
          reportSections.push('### Resource Usage Monitoring');
          reportSections.push(`- **Peak Memory Usage:** ${(resourceUsageInfo.peakMemory / 1024 / 1024).toFixed(2)} MB`);
          reportSections.push(`- **CPU Time:** ${resourceUsageInfo.cpuTime}ms`);
          reportSections.push(`- **Current Memory Usage:** ${(resourceUsageInfo.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
          reportSections.push(`- **External Memory:** ${(resourceUsageInfo.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);
          
          if (resourceUsageInfo.analysisSteps.length > 0) {
            reportSections.push('');
            reportSections.push('**Analysis Steps Performance:**');
            resourceUsageInfo.analysisSteps.forEach((step: any, index: number) => {
              const memoryDeltaMB = (step.memoryDelta / 1024 / 1024).toFixed(2);
              reportSections.push(`${index + 1}. **${step.step}**: ${step.duration}ms (Memory Δ: ${memoryDeltaMB}MB)`);
            });
          }
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
      } finally {
        // Cleanup: unified system manages its own lifecycle, only dispose legacy pageAnalyzer
        if (!unifiedSystem && pageAnalyzer!) {
          await pageAnalyzer!.dispose();
        }
      }

    } catch (error) {
      response.addError(`Error generating diagnostic report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});