/**
 * browser_find_elements tool - Find elements using multiple search criteria
 */

import { z } from 'zod';
import { ElementDiscovery } from '../diagnostics/element-discovery.js';
import { PageAnalyzer } from '../diagnostics/page-analyzer.js';
import type { SmartConfig } from '../diagnostics/smart-config.js';
import { ArrayBuilder } from '../utils/code-deduplication-utils.js';

// Type definitions for diagnostic info structures
type DiagnosticInfo = {
  iframes?: { count: number; detected: boolean };
  elements?: { totalVisible: number; totalInteractable: number };
  modalStates?: { blockedBy: string[] };
  structureAnalysis?: StructureAnalysis;
};

type StructureAnalysis = {
  iframes?: { count: number; detected: boolean };
  elements?: { totalVisible: number; totalInteractable: number };
  modalStates?: { blockedBy: string[] };
};

type OperationResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: OperationError;
  executionTime: number;
};

type OperationError = {
  message: string;
  code?: string;
  cause?: unknown;
  suggestions?: string[];
};

import { UnifiedDiagnosticSystem } from '../diagnostics/unified-system.js';
import { expectationSchema } from '../schemas/expectation.js';
import type { Tab } from '../tab.js';
import { getErrorMessage } from '../utils/common-formatters.js';
import {
  DiagnosticReportBuilder,
  formatConfidencePercentage,
} from '../utils/report-builder.js';
import { defineTabTool } from './tool.js';

const findElementsSchema = z
  .object({
    searchCriteria: z
      .object({
        text: z.string().optional().describe('Text content to search for'),
        role: z.string().optional().describe('ARIA role to search for'),
        tagName: z.string().optional().describe('HTML tag name to search for'),
        attributes: z
          .record(z.string())
          .optional()
          .describe('Attributes to match'),
      })
      .describe('Search criteria for finding elements'),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of results to return'),
    includeDiagnosticInfo: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include diagnostic information about the page'),
    useUnifiedSystem: z
      .boolean()
      .optional()
      .default(true)
      .describe('Use unified diagnostic system for enhanced error handling'),
    enableEnhancedDiscovery: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Enable enhanced element discovery with contextual suggestions'
      ),
    performanceThreshold: z
      .number()
      .optional()
      .default(500)
      .describe('Performance threshold in milliseconds for element discovery'),
    expectation: expectationSchema.optional(),
  })
  .describe('Find elements using multiple search criteria');

export const browserFindElements = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_find_elements',
    title: 'Find elements',
    type: 'readOnly',
    description:
      'Find elements on the page using multiple search criteria such as text, role, tag name, or attributes. Returns matching elements sorted by confidence.',
    inputSchema: findElementsSchema,
  },
  handle: async (tab, params, response) => {
    const context = new FindElementsContext(params);
    contextInstance = context;

    try {
      const alternatives = await findElements(tab, context);

      if (alternatives.length === 0) {
        response.addResult(
          'No elements found matching the specified criteria.'
        );
        return;
      }

      // Register found elements as custom refs in the tab
      // Use batch-aware ref generation for consistent refs across batch operations
      const batchId = tab.context.batchContext?.batchId;
      const usesBatchRefs = Boolean(batchId);

      if (usesBatchRefs) {
        // For batch operations, use getNextCustomRefId with batchId to ensure uniqueness
        for (const alt of alternatives) {
          const customRef = tab.getNextCustomRefId({ batchId });
          tab.registerCustomRef(customRef, alt.selector);
          alt.ref = customRef;
        }
      } else {
        // For non-batch operations, maintain backward compatibility with found_N pattern
        // Clear previous found_ refs and register new ones
        for (let i = 1; i <= 100; i++) {
          tab.unregisterCustomRef(`found_${i}`);
        }
        for (const [index, alt] of alternatives.entries()) {
          const customRef = `found_${index + 1}`;
          tab.registerCustomRef(customRef, alt.selector);
          alt.ref = customRef;
        }
      }

      const resultsText = formatElementResults(alternatives);
      await addDiagnosticInfoIfRequested(tab, context, resultsText);
      addPerformanceInfoIfAvailable(context, resultsText);

      response.addResult(resultsText.join('\n'));
    } catch (error) {
      response.addError(`Error finding elements: ${getErrorMessage(error)}`);
    } finally {
      await cleanupResources();
    }
  },
});

// Type definitions
interface ElementAlternative {
  ref: string;
  element: string;
  description: string;
  confidence: number;
  textContent: string;
  attributes: Record<string, string>;
  selector: string;
}

// Context class to manage state
class FindElementsContext {
  unifiedSystem: UnifiedDiagnosticSystem | null = null;
  elementDiscovery: ElementDiscovery | null = null;
  operationResult: OperationResult | undefined;
  readonly params: z.infer<typeof findElementsSchema>;

  constructor(params: z.infer<typeof findElementsSchema>) {
    this.params = params;
  }

  get useUnifiedSystem(): boolean {
    return this.params.useUnifiedSystem ?? true;
  }
  get enableEnhancedDiscovery(): boolean {
    return this.params.enableEnhancedDiscovery ?? true;
  }
  get performanceThreshold(): number {
    return this.params.performanceThreshold ?? 500;
  }
  get includeDiagnosticInfo(): boolean {
    return this.params.includeDiagnosticInfo ?? false;
  }
  get searchCriteria(): z.infer<typeof findElementsSchema>['searchCriteria'] {
    return this.params.searchCriteria;
  }
  get maxResults(): number {
    return this.params.maxResults;
  }
}

// Main element finding logic
async function findElements(
  tab: Tab,
  context: FindElementsContext
): Promise<ElementAlternative[]> {
  if (context.useUnifiedSystem) {
    return await findElementsWithUnifiedSystem(tab, context);
  }
  return await findElementsWithLegacySystem(tab, context);
}

async function findElementsWithUnifiedSystem(
  tab: Tab,
  context: FindElementsContext
): Promise<ElementAlternative[]> {
  const configOverrides = buildUnifiedSystemConfig(context);
  context.unifiedSystem = UnifiedDiagnosticSystem.getInstance(
    tab.page,
    configOverrides
  );

  const operationResult = (await context.unifiedSystem.findAlternativeElements(
    context.searchCriteria
  )) as OperationResult;

  context.operationResult = operationResult;

  if (!operationResult.success) {
    throw new Error(buildErrorMessage(operationResult.error));
  }

  return (operationResult.data as ElementAlternative[]) ?? [];
}

async function findElementsWithLegacySystem(
  tab: Tab,
  context: FindElementsContext
): Promise<ElementAlternative[]> {
  context.elementDiscovery = new ElementDiscovery(tab.page);

  const legacyResults = await context.elementDiscovery.findAlternativeElements({
    originalSelector: '',
    searchCriteria: context.searchCriteria,
    maxResults: context.maxResults,
  });

  const alternatives = legacyResults.map((result) => ({
    ref: result.selector,
    element: result.selector,
    description: `Element with selector ${result.selector}`,
    confidence: result.confidence,
    textContent: '',
    attributes: {},
    selector: result.selector,
  }));

  context.operationResult = {
    success: true,
    data: alternatives,
    executionTime: 0,
  };

  return alternatives;
}

function buildUnifiedSystemConfig(
  context: FindElementsContext
): Partial<SmartConfig> {
  return {
    features: {
      enableParallelAnalysis: true,
      enableSmartHandleManagement: true,
      enableAdvancedElementDiscovery: context.enableEnhancedDiscovery,
      enableResourceLeakDetection: true,
      enableRealTimeMonitoring: false,
    },
    performance: {
      enableMetricsCollection: true,
      enableResourceMonitoring: true,
      enablePerformanceWarnings: true,
      autoOptimization: true,
      thresholds: {
        executionTime: {
          elementDiscovery: context.performanceThreshold,
          pageAnalysis: 1000,
          resourceMonitoring: 200,
          parallelAnalysis: 2000,
        },
        memory: {
          maxMemoryUsage: 100 * 1024 * 1024,
          memoryLeakThreshold: 50 * 1024 * 1024,
          gcTriggerThreshold: 80 * 1024 * 1024,
        },
        performance: {
          domElementLimit: 10_000,
          maxDepthLimit: 50,
          largeSubtreeThreshold: 1000,
        },
        dom: {
          totalElements: 10_000,
          maxDepth: 50,
          largeSubtrees: 10,
          elementsWarning: 1500,
          elementsDanger: 3000,
          depthWarning: 15,
          depthDanger: 20,
          largeSubtreeThreshold: 500,
        },
        interaction: {
          clickableElements: 100,
          formElements: 50,
          clickableHigh: 100,
        },
        layout: {
          fixedElements: 10,
          highZIndexElements: 5,
          highZIndexThreshold: 1000,
          excessiveZIndexThreshold: 9999,
        },
      },
    },
  };
}

function buildErrorMessage(errorInfo?: OperationError): string {
  let errorMessage = `Element discovery failed: ${errorInfo?.message ?? 'Unknown error'}`;

  if (errorInfo?.suggestions && errorInfo.suggestions.length > 0) {
    errorMessage += '\n\nSuggestions:';
    for (const suggestion of errorInfo.suggestions) {
      errorMessage += `\n- ${suggestion}`;
    }
  }

  return errorMessage;
}

function formatElementResults(alternatives: ElementAlternative[]): string[] {
  const builder = new DiagnosticReportBuilder();

  builder.addLine(
    `Found ${alternatives.length} elements matching the criteria:`
  );
  builder.addEmptyLine();

  for (const [index, alt] of alternatives.entries()) {
    builder.addLine(`${index + 1}. Ref: ${alt.ref}`);
    builder.addLine(`   Selector: ${alt.selector}`);
    builder.addLine(
      `   Confidence: ${formatConfidencePercentage(alt.confidence)}`
    );
    builder.addLine(
      `   Reason: ${(alt as ElementAlternative & { reason?: string }).reason ?? 'No reason provided'}`
    );
    if (index < alternatives.length - 1) {
      builder.addEmptyLine();
    }
  }

  return builder.getSections();
}

async function addDiagnosticInfoIfRequested(
  tab: Tab,
  context: FindElementsContext,
  resultsText: string[]
): Promise<void> {
  if (!context.includeDiagnosticInfo) {
    return;
  }

  if (context.unifiedSystem) {
    await addUnifiedDiagnosticInfo(context.unifiedSystem, resultsText);
  } else {
    await addLegacyDiagnosticInfo(tab, resultsText);
  }
}

async function addUnifiedDiagnosticInfo(
  unifiedSystem: UnifiedDiagnosticSystem,
  resultsText: string[]
): Promise<void> {
  const diagResult = await unifiedSystem.analyzePageStructure();
  const builder = new DiagnosticReportBuilder();

  if (diagResult.success) {
    const diagnosticInfo = diagResult.data as DiagnosticInfo;
    builder.addSection('Enhanced Diagnostic Information', (b) => {
      b.addKeyValue('Analysis time', `${diagResult.executionTime ?? 0}ms`);
      addStructuralDiagnosticInfo(diagnosticInfo, b.getSections());
    });
  } else {
    builder.addSection('Diagnostic Information', (b) => {
      b.addListItem(
        `Error getting diagnostic information: ${diagResult.error?.message ?? 'Unknown error'}`
      );
    });
  }

  resultsText.push('', ...builder.getSections());
}

function addStructuralDiagnosticInfo(
  diagnosticInfo: DiagnosticInfo,
  resultsText: string[]
): void {
  if (diagnosticInfo?.structureAnalysis) {
    addParallelAnalysisInfo(diagnosticInfo.structureAnalysis, resultsText);
  } else {
    addStandardAnalysisInfo(diagnosticInfo, resultsText);
  }
}

function addParallelAnalysisInfo(
  structure: StructureAnalysis,
  resultsText: string[]
): void {
  const analysisInfo = new ArrayBuilder<string>()
    .add(
      `- Page has ${structure.iframes?.count ?? 0} iframes detected: ${structure.iframes?.detected}`
    )
    .add(`- Total visible elements: ${structure.elements?.totalVisible ?? 0}`)
    .add(
      `- Total interactable elements: ${structure.elements?.totalInteractable ?? 0}`
    )
    .addIf(
      !!(
        structure.modalStates?.blockedBy &&
        structure.modalStates.blockedBy.length > 0
      ),
      `- Page blocked by: ${structure.modalStates?.blockedBy?.join(', ') ?? ''}`
    )
    .build();

  resultsText.push(...analysisInfo);
}

function addStandardAnalysisInfo(
  diagnosticInfo: DiagnosticInfo,
  resultsText: string[]
): void {
  const analysisInfo = new ArrayBuilder<string>()
    .add(
      `- Page has ${diagnosticInfo?.iframes?.count ?? 0} iframes detected: ${diagnosticInfo?.iframes?.detected}`
    )
    .add(
      `- Total visible elements: ${diagnosticInfo?.elements?.totalVisible ?? 0}`
    )
    .add(
      `- Total interactable elements: ${diagnosticInfo?.elements?.totalInteractable ?? 0}`
    )
    .addIf(
      !!(
        diagnosticInfo?.modalStates?.blockedBy &&
        diagnosticInfo.modalStates.blockedBy.length > 0
      ),
      `- Page blocked by: ${diagnosticInfo?.modalStates?.blockedBy?.join(', ') ?? ''}`
    )
    .build();

  resultsText.push(...analysisInfo);
}

async function addLegacyDiagnosticInfo(
  tab: Tab,
  resultsText: string[]
): Promise<void> {
  const pageAnalyzer = new PageAnalyzer(tab.page);
  try {
    const diagnosticInfo = await pageAnalyzer.analyzePageStructure();

    resultsText.push('', '### Diagnostic Information');
    resultsText.push(
      `- Page has ${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`
    );
    resultsText.push(
      `- Total visible elements: ${diagnosticInfo.elements.totalVisible}`
    );
    resultsText.push(
      `- Total interactable elements: ${diagnosticInfo.elements.totalInteractable}`
    );

    if (diagnosticInfo.modalStates.blockedBy.length > 0) {
      resultsText.push(
        `- Page blocked by: ${diagnosticInfo.modalStates.blockedBy.join(', ')}`
      );
    }
  } finally {
    await pageAnalyzer.dispose();
  }
}

function addPerformanceInfoIfAvailable(
  context: FindElementsContext,
  resultsText: string[]
): void {
  if (
    !(
      context.useUnifiedSystem &&
      context.operationResult &&
      context.enableEnhancedDiscovery
    )
  ) {
    return;
  }

  const builder = new DiagnosticReportBuilder();
  builder.addSection('Enhanced Discovery Information', (b) => {
    b.addKeyValue(
      'Discovery execution time',
      `${context.operationResult?.executionTime ?? 0}ms`
    );

    if (
      context.operationResult?.executionTime &&
      context.operationResult?.executionTime > context.performanceThreshold
    ) {
      b.addListItem(
        `⚠️ Discovery exceeded performance threshold (${context.performanceThreshold}ms)`
      );
    } else {
      b.addListItem('✅ Discovery within performance threshold');
    }
  });

  resultsText.push('', ...builder.getSections());
}

let contextInstance: FindElementsContext | null = null;

async function cleanupResources(): Promise<void> {
  if (contextInstance?.elementDiscovery) {
    await contextInstance.elementDiscovery.dispose();
  }
  contextInstance = null;
}
