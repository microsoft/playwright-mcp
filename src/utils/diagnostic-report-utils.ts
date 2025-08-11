/**
 * Diagnostic report building utilities to reduce code duplication
 *
 * This module provides common patterns for building diagnostic reports
 * with consistent formatting and structure.
 */

import { getErrorMessage } from './common-formatters.js';
import type { TextReportBuilder } from './report-builder.js';

type KeyValueConfigValue = string | number | boolean | null | undefined;
type KeyValueConfigFormatter = (value: KeyValueConfigValue) => string;

export interface KeyValueConfig {
  key: string;
  value: KeyValueConfigValue;
  formatter?: KeyValueConfigFormatter;
}

export interface SystemStatsConfig {
  status: string;
  totalOperations: number;
  successRate: number;
  activeHandles: number;
  totalErrors: number;
}

export interface PageStructureConfig {
  url: string;
  title?: string;
  iframes: {
    detected: boolean;
    count: number;
    accessible: number;
    inaccessible: number;
  };
  elements: {
    totalVisible: number;
    totalInteractable: number;
    missingAria: number;
  };
  modalStates: {
    blockedBy: string[];
  };
}

export interface PerformanceMetricsConfig {
  domMetrics?: {
    totalElements: number;
    maxDepth: number;
    largeSubtrees?: Array<{
      selector: string;
      elementCount: number;
      description: string;
    }>;
  };
  interactionMetrics?: {
    clickableElements: number;
    formElements: number;
    disabledElements: number;
  };
  resourceMetrics?: {
    imageCount: number;
    estimatedImageSize: string;
    scriptTags: number;
    externalScripts: number;
    inlineScripts: number;
    stylesheetCount: number;
  };
}

/**
 * Adds multiple key-value pairs to a report builder with consistent formatting
 */
export function addKeyValuePairs(
  builder: TextReportBuilder,
  configs: KeyValueConfig[]
): TextReportBuilder {
  let currentBuilder = builder;

  for (const config of configs) {
    const formattedValue = config.formatter
      ? config.formatter(config.value)
      : formatValue(config.value);

    currentBuilder = currentBuilder.addKeyValue(config.key, formattedValue);
  }

  return currentBuilder;
}

/**
 * Adds system health statistics section
 */
export function addSystemHealthSection(
  builder: TextReportBuilder,
  stats: SystemStatsConfig,
  sectionTitle = 'Unified System Health'
): void {
  builder.addSection(sectionTitle, (sectionBuilder) => {
    addKeyValuePairs(sectionBuilder, [
      { key: 'System Status', value: stats.status },
      { key: 'Total Operations', value: stats.totalOperations },
      {
        key: 'Success Rate',
        value: stats.successRate,
        formatter: (value) => `${((value as number) * 100).toFixed(1)}%`,
      },
      { key: 'Active Handles', value: stats.activeHandles },
      { key: 'Total Errors', value: stats.totalErrors },
    ]);
  });
}

/**
 * Adds basic page structure information
 */
export function addBasicPageStructure(
  builder: TextReportBuilder,
  config: PageStructureConfig
): TextReportBuilder {
  let currentBuilder = builder.addKeyValue('URL', config.url);

  if (config.title) {
    currentBuilder = currentBuilder.addKeyValue('Title', config.title);
  }

  return currentBuilder.addEmptyLine();
}

/**
 * Adds comprehensive page structure analysis
 */
export function addComprehensivePageStructure(
  builder: TextReportBuilder,
  config: PageStructureConfig
): TextReportBuilder {
  return addKeyValuePairs(builder, [
    { key: 'URL', value: config.url },
    { key: 'Title', value: config.title ?? 'N/A' },
    {
      key: 'IFrames',
      value: `${config.iframes.count} iframes detected: ${config.iframes.detected}`,
    },
    { key: 'Accessible iframes', value: config.iframes.accessible },
    { key: 'Inaccessible iframes', value: config.iframes.inaccessible },
    { key: 'Total visible elements', value: config.elements.totalVisible },
    {
      key: 'Total interactable elements',
      value: config.elements.totalInteractable,
    },
    { key: 'Elements missing ARIA', value: config.elements.missingAria },
  ]).addEmptyLine();
}

/**
 * Adds DOM complexity metrics section
 */
export function addDomComplexityMetrics(
  builder: TextReportBuilder,
  metrics: PerformanceMetricsConfig
): void {
  if (!metrics.domMetrics) {
    return;
  }

  const domMetrics = metrics.domMetrics;

  builder.addEmptyLine().addHeader('DOM Complexity', 3);

  addKeyValuePairs(builder, [
    { key: 'Total DOM elements', value: domMetrics.totalElements ?? 0 },
    {
      key: 'Max DOM depth',
      value: domMetrics.maxDepth ?? 0,
      formatter: (value) => `${value} levels`,
    },
  ]);

  if (domMetrics.largeSubtrees?.length) {
    builder.addKeyValue(
      'Large subtrees detected',
      domMetrics.largeSubtrees.length
    );

    for (const [index, subtree] of domMetrics.largeSubtrees
      .slice(0, 3)
      .entries()) {
      builder.addLine(
        `  ${index + 1}. **${subtree.selector}**: ${subtree.elementCount} elements (${subtree.description})`
      );
    }
  }
}

/**
 * Adds interaction metrics section
 */
export function addInteractionMetrics(
  builder: TextReportBuilder,
  metrics: PerformanceMetricsConfig
): void {
  if (!metrics.interactionMetrics) {
    return;
  }

  builder.addEmptyLine().addHeader('Interaction Elements', 3);

  addKeyValuePairs(builder, [
    {
      key: 'Clickable elements',
      value: metrics.interactionMetrics.clickableElements ?? 0,
    },
    {
      key: 'Form elements',
      value: metrics.interactionMetrics.formElements ?? 0,
    },
    {
      key: 'Disabled elements',
      value: metrics.interactionMetrics.disabledElements ?? 0,
    },
  ]);
}

/**
 * Adds resource metrics section
 */
export function addResourceMetrics(
  builder: TextReportBuilder,
  metrics: PerformanceMetricsConfig
): void {
  if (!metrics.resourceMetrics) {
    return;
  }

  const resourceMetrics = metrics.resourceMetrics;

  builder.addEmptyLine().addHeader('Resource Load', 3);

  addKeyValuePairs(builder, [
    {
      key: 'Images',
      value: `${resourceMetrics.imageCount ?? 0} (${resourceMetrics.estimatedImageSize ?? 'Unknown'}))`,
    },
    {
      key: 'Script tags',
      value: `${resourceMetrics.scriptTags ?? 0} (${resourceMetrics.externalScripts ?? 0} external, ${resourceMetrics.inlineScripts ?? 0} inline)`,
    },
    { key: 'Stylesheets', value: resourceMetrics.stylesheetCount ?? 0 },
  ]);
}

/**
 * Adds modal states section if modals are present
 */
export function addModalStatesIfPresent(
  builder: TextReportBuilder,
  modalStates: { blockedBy: string[] }
): void {
  if (modalStates.blockedBy.length > 0) {
    builder
      .addHeader('Modal States', 2)
      .addKeyValue('Active modals', modalStates.blockedBy.join(', '))
      .addEmptyLine();
  }
}

/**
 * Handles error display with consistent formatting
 */
export function addErrorSection(
  builder: TextReportBuilder,
  error: unknown,
  context: string
): void {
  builder
    .addEmptyLine()
    .addKeyValue(`Error ${context}`, getErrorMessage(error));
}

/**
 * Format a value consistently for display
 */
function formatValue(value: KeyValueConfigValue): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  return String(value);
}

/**
 * Add formatted element list with consistent structure
 * Reduces duplication in various element list formatting patterns
 */
export function addElementList<T>(
  builder: TextReportBuilder,
  title: string,
  elements: T[] | undefined,
  formatter: (element: T, index: number) => string,
  maxItems = 5
): void {
  if (!elements?.length) {
    return;
  }

  builder.addEmptyLine().addLine(`**${title}:**`);

  const limitedElements = elements.slice(0, maxItems);
  for (let index = 0; index < limitedElements.length; index++) {
    builder.addLine(formatter(limitedElements[index], index));
  }
}

/**
 * Add optional list section with consistent header and content formatting
 * Reduces duplication in conditional list sections
 */
export function addOptionalListSection<T>(
  builder: TextReportBuilder,
  title: string,
  items: T[] | undefined,
  formatter: (item: T) => string,
  headerLevel = 2
): void {
  if (!items?.length) {
    return;
  }

  builder.addSection(
    title,
    (sectionBuilder) => {
      for (const item of items) {
        sectionBuilder.addListItem(formatter(item));
      }
    },
    headerLevel
  );
}

// ArrayBuilder moved to codeDeduplicationUtils.ts to avoid duplication
