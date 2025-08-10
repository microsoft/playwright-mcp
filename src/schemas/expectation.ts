import { z } from 'zod';
/**
 * Schema for diff options configuration
 */
export const diffOptionsSchema = z
  .object({
    enabled: z.boolean().default(false),
    threshold: z.number().min(0).max(1).default(0.1),
    format: z.enum(['unified', 'split', 'minimal']).default('unified'),
    maxDiffLines: z.number().positive().default(50),
    ignoreWhitespace: z.boolean().default(true),
    context: z.number().min(0).default(3),
  })
  .optional();
/**
 * Schema for expectation configuration that controls response content
 */
export const expectationSchema = z
  .object({
    includeSnapshot: z.boolean().optional().default(false),
    includeConsole: z.boolean().optional().default(false),
    includeDownloads: z.boolean().optional().default(false),
    includeTabs: z.boolean().optional().default(false),
    includeCode: z.boolean().optional().default(false),
    snapshotOptions: z
      .object({
        selector: z
          .string()
          .optional()
          .describe('CSS selector to limit snapshot scope'),
        maxLength: z
          .number()
          .optional()
          .describe('Maximum characters for snapshot'),
        format: z.enum(['aria', 'text', 'html']).optional().default('aria'),
      })
      .optional(),
    consoleOptions: z
      .object({
        levels: z.array(z.enum(['log', 'warn', 'error', 'info'])).optional(),
        maxMessages: z.number().optional().default(10),
        patterns: z
          .array(z.string())
          .optional()
          .describe('Regex patterns to filter messages'),
        removeDuplicates: z
          .boolean()
          .optional()
          .default(false)
          .describe('Remove duplicate messages'),
      })
      .optional(),
    imageOptions: z
      .object({
        quality: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('JPEG quality (1-100)'),
        maxWidth: z.number().optional().describe('Maximum width in pixels'),
        maxHeight: z.number().optional().describe('Maximum height in pixels'),
        format: z.enum(['jpeg', 'png', 'webp']).optional(),
      })
      .optional(),
    diffOptions: diffOptionsSchema,
  })
  .optional();
export type ExpectationOptions = z.infer<typeof expectationSchema>;
/**
 * Tool-specific default expectation configurations
 * These optimize token usage based on typical tool usage patterns
 */
type RequiredExpectationBase = Required<
  Omit<
    NonNullable<ExpectationOptions>,
    'snapshotOptions' | 'consoleOptions' | 'imageOptions' | 'diffOptions'
  >
>;

const TOOL_DEFAULTS: Record<string, RequiredExpectationBase> = {
  // All tools default to minimal output for maximum token efficiency
  // Users can enable specific outputs as needed
  browser_navigate: {
    includeSnapshot: true,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: true,
    includeCode: true,
  },
  browser_click: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  browser_type: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  browser_take_screenshot: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  // Snapshot tool must include snapshot as that's its purpose
  browser_snapshot: {
    includeSnapshot: true,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  // All tools default to minimal output
  browser_evaluate: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  browser_wait_for: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  browser_close: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: true,
    includeCode: true,
  },
};
/**
 * General default configuration for tools without specific settings
 */
const GENERAL_DEFAULT: RequiredExpectationBase = {
  includeSnapshot: false,
  includeConsole: false,
  includeDownloads: false,
  includeTabs: false,
  includeCode: false,
};
/**
 * Get default expectation configuration for a specific tool
 * @param toolName - Name of the tool (e.g., 'click', 'navigate', 'screenshot')
 * @returns Default expectation configuration optimized for the tool
 */
export function getDefaultExpectation(
  toolName: string
): RequiredExpectationBase {
  return TOOL_DEFAULTS[toolName] ?? GENERAL_DEFAULT;
}
/**
 * Merge user-provided expectation with tool-specific defaults
 * @param toolName - Name of the tool
 * @param userExpectation - User-provided expectation options
 * @returns Merged expectation configuration
 */
export function mergeExpectations(
  toolName: string,
  userExpectation?: ExpectationOptions
): NonNullable<ExpectationOptions> {
  const defaults = getDefaultExpectation(toolName);
  if (!userExpectation) {
    return defaults;
  }
  return {
    includeSnapshot:
      userExpectation.includeSnapshot ?? defaults.includeSnapshot,
    includeConsole: userExpectation.includeConsole ?? defaults.includeConsole,
    includeDownloads:
      userExpectation.includeDownloads ?? defaults.includeDownloads,
    includeTabs: userExpectation.includeTabs ?? defaults.includeTabs,
    includeCode: userExpectation.includeCode ?? defaults.includeCode,
    snapshotOptions: userExpectation.snapshotOptions,
    consoleOptions: userExpectation.consoleOptions,
    imageOptions: userExpectation.imageOptions,
    diffOptions: userExpectation.diffOptions,
  };
}
