import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import {
  generateMouseClickCode,
  generateMouseDragCode,
  generateMouseMoveCode,
} from '../utils/common-formatters.js';
import { baseElementSchema } from './base-tool-handler.js';
import { defineTabTool } from './tool.js';

// Simplified element schema for mouse operations (no ref required)
const elementSchema = baseElementSchema
  .pick({ element: true })
  .required({ element: true });
const mouseMove = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_move_xy',
    title: 'Move mouse',
    description:
      'Move mouse to specific coordinates.Requires --caps=vision.x,y:coordinates.expectation:{includeSnapshot:false} for simple move,true to see hover effects.PREFER element-based interactions over coordinates when possible.',
    inputSchema: elementSchema.extend({
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    response.addCode(`// Move mouse to (${params.x}, ${params.y})`);
    response.addCode(generateMouseMoveCode(params.x, params.y));
    await tab.waitForCompletion(async () => {
      await tab.page.mouse.move(params.x, params.y);
    });
  },
});
const mouseClick = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_click_xy',
    title: 'Click',
    description:
      'Click at specific coordinates.Requires --caps=vision.x,y:click position.expectation:{includeSnapshot:true} to verify result.PREFER browser_click with element ref over coordinates.USE batch_execute for coordinate-based workflows.',
    inputSchema: elementSchema.extend({
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      expectation: expectationSchema,
    }),
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    response.addCode(
      `// Click mouse at coordinates (${params.x}, ${params.y})`
    );
    response.addCode(generateMouseMoveCode(params.x, params.y));
    for (const code of generateMouseClickCode()) {
      response.addCode(code);
    }
    await tab.waitForCompletion(async () => {
      await tab.page.mouse.move(params.x, params.y);
      await tab.page.mouse.down();
      await tab.page.mouse.up();
    });
  },
});
const mouseDrag = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_drag_xy',
    title: 'Drag mouse',
    description: `Drag from one coordinate to another.Requires --caps=vision.startX,startY→endX,endY.expectation:{includeSnapshot:true,snapshotOptions:{selector:".drop-zone"}} to verify.PREFER browser_drag with element refs over coordinates.`,
    inputSchema: elementSchema.extend({
      startX: z.number().describe('Start X coordinate'),
      startY: z.number().describe('Start Y coordinate'),
      endX: z.number().describe('End X coordinate'),
      endY: z.number().describe('End Y coordinate'),
      expectation: expectationSchema,
    }),
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    for (const code of generateMouseDragCode(
      params.startX,
      params.startY,
      params.endX,
      params.endY
    )) {
      response.addCode(code);
    }
    await tab.waitForCompletion(async () => {
      await tab.page.mouse.move(params.startX, params.startY);
      await tab.page.mouse.down();
      await tab.page.mouse.move(params.endX, params.endY);
      await tab.page.mouse.up();
    });
  },
});
export default [mouseMove, mouseClick, mouseDrag];
