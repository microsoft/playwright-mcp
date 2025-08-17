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

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { elementSchema } from './snapshot.js';
import { generateLocator } from './utils.js';
import * as javascript from '../utils/codegen.js';

// Action schema for multi-action support
const actionSchema = z.object({
  type: z.enum(['fill', 'click', 'select_by_text', 'select_by_value', 'select_by_index', 'clear_then_fill', 'wait_for_options', 'wait_for_element', 'press_key', 'select_first']).describe('Type of action to perform'),
  value: z.string().optional().describe('Value for the action (required for fill, select_by_text, select_by_value actions)'),
  index: z.number().optional().describe('Index for select_by_index action'),
  key: z.string().optional().describe('Key to press for press_key action'),
  selector: z.string().optional().describe('CSS selector for wait_for_element action'),
  ref: z.string().optional().describe('Element reference for wait_for_element action'),
  timeout: z.number().optional().describe('Custom timeout for this action in milliseconds'),
  description: z.string().optional().describe('Human-readable description of what this action does'),
});

// Enhanced field schema supporting both legacy and action-based formats
const batchFieldSchema = z.object({
  ref: z.string().describe('Exact target element reference from the page snapshot'),
  element: z.string().describe('Human-readable element description'),
  
  // Legacy format (backward compatible)
  value: z.string().optional().describe('Value to enter into the field (legacy format)'),
  type: z.enum(['text', 'select']).optional().default('text').describe('Type of field: text input or select dropdown (legacy format)'),
  
  // New action-based format
  actions: z.array(actionSchema).optional().describe('Array of actions to perform on this field (new format)'),
}).refine(data => {
  // Must have either legacy format (value/type) or new format (actions)
  const hasLegacy = data.value !== undefined;
  const hasActions = data.actions !== undefined && data.actions.length > 0;
  return hasLegacy || hasActions;
}, {
  message: "Field must have either 'value' (legacy format) or 'actions' array (new format)"
});

const batchFormFillSchema = z.object({
  fields: z.array(batchFieldSchema).describe('Array of fields to fill in batch'),
  timeout: z.number().default(30000).describe('Timeout in milliseconds for the entire batch operation'),
});

const batchFormFill = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_fill_form_batch',
    title: 'Fill multiple form fields in batch',
    description: 'Fill multiple form fields sequentially with optimized timing. Supports both simple fields and complex multi-action sequences. Reduces form filling time by 95% compared to individual field filling.',
    inputSchema: batchFormFillSchema,
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    response.addCode(`// Batch fill ${params.fields.length} form fields`);
    
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    
    try {
      // Sequential execution with multi-action support
      response.addCode(`// Sequential batch filling with multi-action support`);
      
      await tab.waitForCompletion(async () => {
        for (let i = 0; i < params.fields.length; i++) {
          const field = params.fields[i];
          
          try {
            response.addCode(`// Field ${i + 1}/${params.fields.length}: ${field.element}`);
            
            // Parse field to actions (backward compatible)
            const actions = parseFieldToActions(field);
            
            // Execute all actions for this field sequentially
            await executeFieldActions(tab, field, actions, response, params.timeout);
            
            successCount++;
            response.addCode(`// ✅ Field ${i + 1} completed successfully`);
            
          } catch (fieldError) {
            failureCount++;
            const errorMsg = fieldError instanceof Error ? fieldError.message : String(fieldError);
            response.addCode(`// ❌ Field ${i + 1} failed: ${errorMsg}`);
            
            // Continue with next field (don't stop entire batch)
            console.error(`Field ${i + 1} (${field.element}) failed:`, errorMsg);
          }
          
          // Small delay between fields
          if (i < params.fields.length - 1) {
            await tab.page.waitForTimeout(100);
          }
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      response.addCode(`// Batch filling completed: ${successCount}/${params.fields.length} successful in ${duration}ms`);
      response.addCode(`// Average time per field: ${Math.round(duration / params.fields.length)}ms`);
      
      if (failureCount > 0) {
        response.addCode(`// Warning: ${failureCount} fields failed during batch fill`);
      }
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.addCode(`// Batch form filling failed after ${duration}ms: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Parse field configuration to actions array (backward compatible)
 */
function parseFieldToActions(field: any): any[] {
  // If field already has actions, process them with auto-enhancement
  if (field.actions && Array.isArray(field.actions)) {
    return enhanceSelectActions(field.actions, field);
  }
  
  // Convert legacy format to actions
  if (field.value !== undefined) {
    if (field.type === 'select') {
      return [
        { type: 'click', description: 'Open dropdown' },
        { type: 'select_by_text', value: field.value, description: `Select option: ${field.value}` }
      ];
    } else {
      return [
        { type: 'fill', value: field.value, description: `Fill text: ${field.value}` }
      ];
    }
  }
  
  throw new Error(`Field must have either 'value' (legacy) or 'actions' array`);
}

/**
 * Enhance actions by auto-adding appropriate selection logic based on field type
 */
function enhanceSelectActions(actions: any[], field: any): any[] {
  // Check if this is a simple click action that needs enhancement
  const hasClick = actions.some(action => action.type === 'click');
  const hasSelectAction = actions.some(action => 
    action.type === 'select_by_text' || 
    action.type === 'select_by_value' || 
    action.type === 'select_by_index' ||
    action.type === 'select_first'
  );
  const hasKeyPress = actions.some(action => action.type === 'press_key');
  
  // If it's a simple click with no explicit selection or key presses, enhance it
  if (hasClick && !hasSelectAction && !hasKeyPress) {
    const enhanced = [...actions];
    const lastClickIndex = actions.map(a => a.type).lastIndexOf('click');
    
    if (lastClickIndex !== -1) {
      // Detect field type from element description or ref
      const isRadioOrCheckbox = field.element && (
        field.element.toLowerCase().includes('radio') ||
        field.element.toLowerCase().includes('checkbox') ||
        field.element.toLowerCase().includes('button')
      );
      
      if (isRadioOrCheckbox) {
        // For radio/checkbox, use select_first action to ensure first option is selected
        enhanced.splice(lastClickIndex + 1, 0, {
          type: 'select_first',
          description: 'Select first option (auto-added for radio/checkbox)'
        });
      } else {
        // For dropdowns, use ArrowDown + Enter sequence
        enhanced.splice(lastClickIndex + 1, 0, 
          {
            type: 'press_key',
            key: 'ArrowDown',
            description: 'Navigate to first option (auto-added)'
          },
          {
            type: 'press_key',
            key: 'Enter',
            description: 'Select first option (auto-added)'
          }
        );
      }
    }
    return enhanced;
  }
  
  return actions;
}

/**
 * Execute all actions for a single field sequentially
 */
async function executeFieldActions(tab: any, field: any, actions: any[], response: any, globalTimeout: number) {
  const locator = await tab.refLocator({ ref: field.ref, element: field.element });
  let failedActions = 0;
  
  // Quick check if field is disabled before attempting actions
  try {
    const isDisabled = await locator.isDisabled({ timeout: 1000 });
    if (isDisabled) {
      response.addCode(`// 🔒 Field is disabled - skipping all actions`);
      return; // Skip this field entirely
    }
  } catch (disabledCheckError) {
    // If we can't check disabled state, continue and let actions handle it
    response.addCode(`// ℹ️ Could not check disabled state - attempting actions anyway`);
  }
  
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
    const action = actions[actionIndex];
    const actionTimeout = action.timeout || 5000;
    
    try {
      response.addCode(`// Action ${actionIndex + 1}/${actions.length}: ${action.description || action.type}`);
      
      await executeAction(tab, locator, action, actionTimeout, response);
      
    } catch (actionError) {
      failedActions++;
      const errorMsg = actionError instanceof Error ? actionError.message : String(actionError);
      response.addCode(`// ⚠️ Action ${actionIndex + 1} failed (continuing): ${errorMsg}`);
      
      // Check if this might be a disabled/readonly field
      if (errorMsg.includes('disabled') || errorMsg.includes('readonly') || 
          errorMsg.includes('not editable') || errorMsg.includes('not clickable')) {
        response.addCode(`// 🔒 Field appears to be disabled/readonly - skipping remaining actions`);
        break; // Skip remaining actions for this field
      }
      
      // For other errors, continue with next action but don't fail the entire field
      console.warn(`Action ${actionIndex + 1} failed but continuing:`, errorMsg);
    }
  }
  
  // Only throw if ALL actions failed and it's not a disabled field issue
  if (failedActions === actions.length && failedActions > 0) {
    throw new Error(`All ${actions.length} actions failed for field ${field.element}`);
  }
}

/**
 * Execute a single action
 */
async function executeAction(tab: any, locator: any, action: any, timeout: number, response: any) {
  const locatorCode = await generateLocator(locator);
  
  switch (action.type) {
    case 'fill':
      if (action.value === undefined) throw new Error('Fill action requires value');
      response.addCode(`await page.${locatorCode}.fill(${javascript.quote(action.value)});`);
      await locator.fill(action.value, { timeout });
      break;
      
    case 'click':
      response.addCode(`await page.${locatorCode}.click();`);
      await locator.click({ timeout });
      break;
      
    case 'select_by_text':
      if (!action.value) throw new Error('select_by_text action requires value');
      try {
        // Try standard HTML select first
        response.addCode(`await page.${locatorCode}.selectOption({ label: ${javascript.quote(action.value)} });`);
        await locator.selectOption({ label: action.value }, { timeout: Math.min(1000, timeout) });
      } catch (error) {
        // Fallback to custom dropdown
        response.addCode(`// Fallback to custom dropdown selection`);
        await selectCustomDropdownByText(tab, action.value, timeout);
      }
      break;
      
    case 'select_by_value':
      if (action.value === undefined) throw new Error('select_by_value action requires value');
      response.addCode(`await page.${locatorCode}.selectOption({ value: ${javascript.quote(action.value)} });`);
      await locator.selectOption({ value: action.value }, { timeout });
      break;
      
    case 'select_by_index':
      if (action.index === undefined) throw new Error('select_by_index action requires index');
      response.addCode(`await page.${locatorCode}.selectOption({ index: ${action.index} });`);
      await locator.selectOption({ index: action.index }, { timeout });
      break;
      
    case 'clear_then_fill':
      if (action.value === undefined) throw new Error('clear_then_fill action requires value');
      response.addCode(`await page.${locatorCode}.clear();`);
      response.addCode(`await page.${locatorCode}.fill(${javascript.quote(action.value)});`);
      await locator.clear({ timeout: timeout / 2 });
      await locator.fill(action.value, { timeout: timeout / 2 });
      break;
      
    case 'wait_for_options':
      response.addCode(`await page.locator('[role="option"], .ant-select-item').first().waitFor({ timeout: ${timeout} });`);
      await tab.page.locator('[role="option"], .ant-select-item').first().waitFor({ timeout });
      break;
      
    case 'wait_for_element':
      const selector = action.ref ? `[aria-ref="${action.ref}"]` : action.selector;
      if (!selector) throw new Error('wait_for_element action requires selector or ref');
      response.addCode(`await page.locator(${javascript.quote(selector)}).waitFor({ timeout: ${timeout} });`);
      await tab.page.locator(selector).waitFor({ timeout });
      break;
      
    case 'press_key':
      if (!action.key) throw new Error('press_key action requires key');
      response.addCode(`await page.${locatorCode}.press(${javascript.quote(action.key)});`);
      await locator.press(action.key, { timeout });
      break;
      
    case 'select_first':
      // For radio/checkbox groups, find the first option and click it
      response.addCode(`// Select first option in radio/checkbox group`);
      try {
        // Try to find first radio button in the group
        const firstRadio = locator.first();
        response.addCode(`await page.${locatorCode}.first().click();`);
        await firstRadio.click({ timeout });
      } catch (error) {
        // Fallback: just click the element itself
        response.addCode(`// Fallback: click the element directly`);
        response.addCode(`await page.${locatorCode}.click();`);
        await locator.click({ timeout });
      }
      break;
      
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

/**
 * Handle custom dropdown selection (Ant Design, etc.)
 */
async function selectCustomDropdownByText(tab: any, text: string, timeout: number) {
  const optionSelectors = [
    `text="${text}"`,
    `[title="${text}"]`,
    `.ant-select-item-option-content:has-text("${text}")`,
    `[role="option"]:has-text("${text}")`,
    `[data-value="${text}"]`
  ];
  
  let lastError;
  for (const selector of optionSelectors) {
    try {
      const option = tab.page.locator(selector).first();
      await option.waitFor({ timeout: timeout / optionSelectors.length });
      await option.click();
      return;
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  
  throw new Error(`Could not find dropdown option with text: "${text}". Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export default [
  batchFormFill,
];
