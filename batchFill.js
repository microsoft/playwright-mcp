/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check
'use strict';

/**
 * Batch Form Fill Tool for Playwright MCP
 *
 * Fills multiple form fields in a single tool call (single round-trip), reducing
 * multiple network round-trips and LLM decisions to a single call.
 * to a single call.
 *
 * Two execution modes:
 *   1. Flat `actions` array — actions are processed sequentially (in one tool call)
 *   2. Dependency `groups` — groups run sequentially with a configurable
 *      delay; actions within each group are processed sequentially
 *
 * When NOT to use this tool (use browser_fill_form or browser_type instead):
 *   - Fields that expand or reveal additional inputs on change
 *   - Fields with real-time server-side validation (e.g. username availability)
 *   - CAPTCHA or multi-step wizard forms
 */

/**
 * Injects the browser_fill_form_batch tool into the Playwright MCP tool
 * registry. Must be called before createConnection() or decorateMCPCommand().
 *
 * Uses the exported `browserTools` array from coreBundle — the same array
 * that filteredTools() reads from when building the MCP server.
 */
function injectBatchFillTool() {
  const coreBundle = require('playwright-core/lib/coreBundle');
  const { z } = require('playwright-core/lib/utilsBundle');


  if (coreBundle.tools.browserTools.some(t => t.schema?.name === 'browser_fill_form_batch'))
     return;
  const actionItemSchema = z.object({
    selector: z.string().describe(
      'CSS selector, text selector, or Playwright-compatible locator string for the target input element.'
    ),
    value: z.string().describe(
      'The value to fill/set. For checkboxes use "true" or "false". For dropdowns use the visible option label text.'
    ),
    type: z.enum(['fill', 'check', 'select']).optional().describe(
      'Type of form interaction. "fill" (default) for text/number/email inputs, ' +
      '"check" for checkboxes and radio buttons, "select" for dropdown/combobox elements.'
    ),
  });

  const batchFillInputSchema = z.object({
    actions: z.array(actionItemSchema).optional().describe(
      'Flat list of form field actions to execute in a single tool call (single round-trip). ' +
       'Actions are processed sequentially; the speedup comes from reducing tool calls/LLM decisions.'
    ),
    groups: z.record(z.string(), z.array(actionItemSchema)).optional().describe(
      'Named dependency groups for dynamic forms. Groups execute sequentially in ' +
      'alphabetical order (e.g. "batch1" runs before "batch2"). Actions within ' +
      'each group are processed sequentially. Use when selecting a value in one field ' +
      'reveals/populates other fields (e.g. Country → State → City).'
    ),
    delayBetweenGroups: z.number().optional().describe(
      'Milliseconds to wait between dependency groups for dynamic fields to render. ' +
      'Defaults to 200ms. Increase for slow-rendering pages.'
    ),
  });

  const batchFillTool = {
    capability: 'core',
    schema: {
      name: 'browser_fill_form_batch',
      title: 'Batch fill form fields',
      description:
        'Fill multiple form input fields in a single tool call (single round-trip). ' +
        'This avoids multiple network round-trips and reduces LLM decision overhead. ' +
        'Use the flat "actions" array for static forms, or "groups" for forms ' +
        'with dependent/dynamic fields. ' +
        'IMPORTANT: Do NOT use this tool for fields that expand or reveal ' +
        'additional inputs on change; use browser_fill_form or browser_type ' +
        'sequentially for those instead.',
      inputSchema: batchFillInputSchema,
      type: 'input',
    },

    handle: async (context, params, response) => {
      const tab = await context.ensureTab();
      const page = tab.page;

      const hasActions = Array.isArray(params.actions) && params.actions.length > 0;
      const hasGroups = params.groups && typeof params.groups === 'object' &&
                        Object.keys(params.groups).length > 0;

      if (!hasActions && !hasGroups) {
        response.addTextResult(
          'Error: Provide either "actions" (array) or "groups" (object) with form fields to fill.'
        );
        return;
      }

      const delayMs = params.delayBetweenGroups ?? 200;
      /** @type {string[]} */
      const errorMessages = [];
      let totalFilled = 0;
      let totalErrors = 0;

      /**
       * Fill a batch of form fields sequentially using Playwright locator APIs.
       *
       * Uses the same .fill(), .setChecked(), .selectOption() methods as the
       * existing browser_fill_form tool. The speed gain comes from batching
       * the LLM decision (1 tool call instead of N), not from parallel
       * browser execution.
       *
       * @param {Array<{selector: string, value: string, type?: 'fill' | 'check' | 'select'}>} actions
       * @param {string} groupLabel
       */
      async function executeBatch(actions, groupLabel) {
        for (const action of actions) {
          try {
            const locator = page.locator(action.selector);
            const actionType = action.type || 'fill';

            if (actionType === 'fill') {
              await locator.fill(action.value, { timeout: 5000 });
              response.addCode(`await page.locator(${JSON.stringify(action.selector)}).fill(${JSON.stringify(action.value)});`);
            } else if (actionType === 'check') {
              const normalized = action.value.trim().toLowerCase();
              if (normalized !== 'true' && normalized !== 'false') {
                throw new Error(`For type "check", value must be "true" or "false" (got "${action.value}").`);
              }
              const checked = normalized === 'true';
              await locator.setChecked(checked, { timeout: 5000 });
              response.addCode(`await page.locator(${JSON.stringify(action.selector)}).setChecked(${checked});`);
            } else if (actionType === 'select') {
              await locator.selectOption({ label: action.value }, { timeout: 5000 });
              response.addCode(`await page.locator(${JSON.stringify(action.selector)}).selectOption({ label: ${JSON.stringify(action.value)} });`);
            }

            totalFilled++;
          } catch (e) {
            totalErrors++;
            const msg = e.message || String(e);
            errorMessages.push(`[${groupLabel}] "${action.selector}": ${msg}`);
          }
        }
      }

      // Mode 1: Flat batch — fill all fields sequentially in one tool call
      if (hasActions) {
        response.addCode(`// Batch fill: ${params.actions.length} fields in a single tool call`);
        await executeBatch(params.actions, 'batch');
      }

      // Mode 2: Dependency groups — groups run sequentially with delay between them
      if (hasGroups) {
        const groupNames = Object.keys(params.groups).sort();
        response.addCode(`// Batch fill: ${groupNames.length} dependency group(s)`);

        for (let i = 0; i < groupNames.length; i++) {
          const name = groupNames[i];
          const groupActions = params.groups[name];

          if (!Array.isArray(groupActions) || groupActions.length === 0)
            continue;

          response.addCode(`// Group "${name}": ${groupActions.length} field(s)`);
          await executeBatch(groupActions, name);

          // Delay between groups for dynamic fields to render
          if (i < groupNames.length - 1 && delayMs > 0) {
            await page.waitForTimeout(delayMs);
            response.addCode(`await page.waitForTimeout(${delayMs}); // wait for dynamic updates`);
          }
        }
      }

      // Summary
      const parts = [`Batch fill complete: ${totalFilled} field(s) filled successfully.`];
      if (totalErrors > 0) {
        parts.push(`${totalErrors} field(s) failed:`);
        parts.push(...errorMessages);
      }
      response.addTextResult(parts.join('\n'));
    },
  };

  // Inject into the exported browserTools array so filteredTools() picks it up
  coreBundle.tools.browserTools.push(batchFillTool);
}

module.exports = { injectBatchFillTool };
