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
import { defineTool, type Tool } from './tool.js';

const evaluate = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_evaluate',
    title: 'Execute JavaScript',
    description: 'Execute JavaScript code in the browser page context',
    inputSchema: z.object({
      code: z.string().describe('JavaScript code to execute in the page context'),
      timeout: z.number().optional().describe('Optional timeout in milliseconds'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const action = async () => {
      const result = await tab.page.evaluate((code: string) => {
        const fn = new Function(code);
        return fn();
      }, params.code);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: result !== undefined ? JSON.stringify(result, null, 2) : 'undefined',
          },
        ],
      };
    };

    const codeLines = [
      `// Execute JavaScript in page context`,
      `await page.evaluate(() => {`,
      ...params.code.split('\n').map(line => `  ${line}`),
      `});`,
    ];

    return {
      code: codeLines,
      action,
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const getHtml = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_get_html',
    title: 'Get page HTML',
    description: 'Get HTML content of the page or a specific element',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector for a specific element (optional)'),
      outer: z.boolean().optional().default(true).describe('Get outer HTML (true) or inner HTML (false)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const action = async () => {
      let html: string;
      
      if (params.selector) {
        const element = tab.page.locator(params.selector).first();
        html = params.outer 
          ? await element.evaluate((el: Element) => el.outerHTML)
          : await element.innerHTML();
      } else {
        html = await tab.page.content();
      }
      
      return {
        content: [
          {
            type: 'text' as const,
            text: html,
          },
        ],
      };
    };

    const codeLines = params.selector
      ? [
          `// Get HTML of element: ${params.selector}`,
          params.outer
            ? `await page.locator('${params.selector}').first().evaluate(el => el.outerHTML);`
            : `await page.locator('${params.selector}').first().innerHTML();`,
        ]
      : [
          `// Get full page HTML`,
          `await page.content();`,
        ];

    return {
      code: codeLines,
      action,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const getAttribute = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_get_attribute',
    title: 'Get element attributes',
    description: 'Get attributes of elements matching a selector',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector for elements'),
      attribute: z.string().optional().describe('Specific attribute to get (optional, returns all if not specified)'),
      all: z.boolean().optional().default(false).describe('Get from all matching elements (true) or just first (false)'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    
    const action = async () => {
      const elements = tab.page.locator(params.selector);
      
      if (params.all) {
        const results = await elements.evaluateAll((els: Element[], attr: string | undefined) => {
          return els.map((el: Element) => {
            if (attr) {
              return el.getAttribute(attr);
            } else {
              const attrs: Record<string, string | null> = {};
              for (const attr of el.attributes) {
                attrs[attr.name] = attr.value;
              }
              return attrs;
            }
          });
        }, params.attribute);
        
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } else {
        const result = await elements.first().evaluate((el: Element, attr: string | undefined) => {
          if (attr) {
            return el.getAttribute(attr);
          } else {
            const attrs: Record<string, string | null> = {};
            for (const attr of el.attributes) {
              attrs[attr.name] = attr.value;
            }
            return attrs;
          }
        }, params.attribute);
        
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    };

    const codeLines = [
      `// Get attributes from: ${params.selector}`,
      params.attribute
        ? params.all
          ? `await page.locator('${params.selector}').evaluateAll(els => els.map(el => el.getAttribute('${params.attribute}')));`
          : `await page.locator('${params.selector}').first().getAttribute('${params.attribute}');`
        : params.all
          ? `await page.locator('${params.selector}').evaluateAll(els => els.map(el => Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value]))));`
          : `await page.locator('${params.selector}').first().evaluate(el => Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])));`,
    ];

    return {
      code: codeLines,
      action,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  evaluate,
  getHtml,
  getAttribute,
];