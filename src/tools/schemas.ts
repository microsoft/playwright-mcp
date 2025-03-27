import { z } from 'zod';
import type { Tool } from './tool';
import { 
  navigateSchema, 
  pressKeySchema, 
  waitSchema, 
  pdfSchema, 
  closeSchema, 
  goBackSchema, 
  goForwardSchema 
} from './common';

// Use the schemas from common.ts
export const CommonToolParams = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('browser_navigate'),
    params: navigateSchema
  }),
  z.object({
    name: z.literal('browser_press_key'),
    params: pressKeySchema
  }),
  z.object({
    name: z.literal('browser_wait'),
    params: waitSchema
  }),
  z.object({
    name: z.literal('browser_save_as_pdf'),
    params: pdfSchema
  }),
  z.object({
    name: z.literal('browser_close'),
    params: closeSchema
  }),
  z.object({
    name: z.literal('browser_go_back'),
    params: goBackSchema
  }),
  z.object({
    name: z.literal('browser_go_forward'),
    params: goForwardSchema
  })
]);

// Base batch schema that will be extended by snapshot/screenshot
export const BatchToolSchema: Tool['schema'] = {
  name: 'batch_process',
  description: 'Run a bunch of steps at the same time',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          test_cases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                definition: { type: 'string' },
                steps: { type: 'array' }
              },
              required: ['definition', 'steps']
            }
          }
        },
        required: ['test_cases']
      }
    },
    required: ['input']
  }
};

export const batchSchema = z.object({
  input: z.object({
    test_cases: z.array(z.object({
      definition: z.string(),
      steps: z.array(z.any())
    }))
  })
});
