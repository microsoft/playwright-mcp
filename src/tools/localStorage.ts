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
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from './tool';

const getItemSchema = z.object({
  key: z.string().describe('The key to retrieve from localStorage'),
});

export const getItem: Tool = {
  schema: {
    name: 'browser_localStorage_get',
    description: 'Get an item from localStorage by key',
    inputSchema: zodToJsonSchema(getItemSchema),
  },

  handle: async (context, params) => {
    const validatedParams = getItemSchema.parse(params);
    const page = await context.ensurePage();
    const value = await page.evaluate((key: string) => window.localStorage.getItem(key), validatedParams.key);
    return {
      content: [{
        type: 'text',
        text: `Retrieved "${validatedParams.key}" from localStorage: ${value === null ? 'null' : `"${value}"`}`,
      }],
    };
  },
};

const setItemSchema = z.object({
  key: z.string().describe('The key to set in localStorage'),
  value: z.string().describe('The value to set for the key'),
});

export const setItem: Tool = {
  schema: {
    name: 'browser_localStorage_set',
    description: 'Set an item in localStorage',
    inputSchema: zodToJsonSchema(setItemSchema),
  },

  handle: async (context, params) => {
    const validatedParams = setItemSchema.parse(params);
    const page = await context.ensurePage();
    await page.evaluate(({ key, value }: { key: string; value: string }) => window.localStorage.setItem(key, value), validatedParams);
    return {
      content: [{
        type: 'text',
        text: `Set localStorage key "${validatedParams.key}" to "${validatedParams.value}"`,
      }],
    };
  },
};

const removeItemSchema = z.object({
  key: z.string().describe('The key to remove from localStorage'),
});

export const removeItem: Tool = {
  schema: {
    name: 'browser_localStorage_remove',
    description: 'Remove an item from localStorage by key',
    inputSchema: zodToJsonSchema(removeItemSchema),
  },

  handle: async (context, params) => {
    const validatedParams = removeItemSchema.parse(params);
    const page = await context.ensurePage();
    await page.evaluate((key: string) => window.localStorage.removeItem(key), validatedParams.key);
    return {
      content: [{
        type: 'text',
        text: `Removed "${validatedParams.key}" from localStorage`,
      }],
    };
  },
};

const clearSchema = z.object({});

export const clear: Tool = {
  schema: {
    name: 'browser_localStorage_clear',
    description: 'Clear all items from localStorage',
    inputSchema: zodToJsonSchema(clearSchema),
  },

  handle: async (context) => {
    const page = await context.ensurePage();
    await page.evaluate(() => window.localStorage.clear());
    return {
      content: [{
        type: 'text',
        text: 'Cleared all items from localStorage',
      }],
    };
  },
};

const getAllSchema = z.object({});

export const getAll: Tool = {
  schema: {
    name: 'browser_localStorage_getAll',
    description: 'Get all items from localStorage',
    inputSchema: zodToJsonSchema(getAllSchema),
  },

  handle: async (context) => {
    const page = await context.ensurePage();
    const items = await page.evaluate(() => {
      const all: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          all[key] = window.localStorage.getItem(key) || '';
        }
      }
      return all;
    });
    
    return {
      content: [{
        type: 'text',
        text: `localStorage contents:\n${JSON.stringify(items, null, 2)}`,
      }],
    };
  },
}; 