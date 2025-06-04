import { z } from 'zod';
import { defineTool } from './tool.js';




const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  label: z.string().describe('Exact label name extracted from action'),
});

const custom_browser_click_on_labeled_element = defineTool({
  capability: 'core',
  schema: {
    name: 'custom_browser_click_on_labeled_element',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: elementSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const element = tab.page.locator(`[label='${params.label}']`);
    const code = [
      `// Click on ${params.element} having  ${params.label}`,
    ];

    return {
      code,
      action: () => element.click(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});




/**
 * Get the title of the current page.
 */
export const custom_click_on_available_section = defineTool({
  capability: 'core',
  schema: {
    name: 'custom_click_on_available_section',
    title: 'Click on Available Section',
    description: 'Finds and clicks on available section',
    inputSchema: z.object({}),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const page = context.currentTabOrDie().page;
    
    // Use locator() instead of querySelector()
    const mapElement = page.locator('.seatmap-viewer');
    // Use getAttribute() on the ElementHandle, not directly on locator
    const mapId = await mapElement.getAttribute('data-viewerid');
  
    // Access the map object using the mapID from the window.DvmViewers
    const items = await page.evaluate((mapId) => {
        // Add null check before using mapId
        if (!mapId) {
          throw new Error("Could not find data-viewerid attribute on seatmap-viewer element");
        }
      const map = (window as any).DvmViewers[mapId];
      const nodes = map.getNodesByType("section").filter((item: { [x: string]: string; }) => 
        item["state"] === "available" && item["tag"] === "none"
      );
      const nodeId = nodes[0].id;
      
      const mapCoordinates = map.getContainer().getBoundingClientRect();
      const nodeCoordinates = map.getNodeById(nodeId).getBoundingClientRect();
      
      const x = nodeCoordinates["x"] - mapCoordinates["x"] + nodeCoordinates["width"] / 2;
      const y = nodeCoordinates["y"] - mapCoordinates["y"] + nodeCoordinates["height"] / 2;
      
      return { x, y, nodeId };
    }, mapId);
  
    const xCoord = Math.floor(items.x);
    const yCoord = Math.floor(items.y);
  
    // Click at the calculated coordinates
    const selector = ".seatmap-viewer .d2m-map-layer";
    const element = page.locator(selector);
    await element.click({ position: { x: xCoord, y: yCoord } });
  
    const code = [
      `// Clicks on Available Section`,
      `Internal Code`
    ];
  
    return {
      code,
      result: items.nodeId,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});



export default [
  custom_click_on_available_section,
  custom_browser_click_on_labeled_element
];