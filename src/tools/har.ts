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
import fs from 'fs/promises';
import { defineTool } from './tool.js';
import { outputFile } from '../config.js';

const save = defineTool({
  capability: 'har',

  schema: {
    name: 'browser_har_save',
    title: 'Save HAR file',
    description: 'Save HTTP Archive (HAR) file of all network traffic captured during the browser session. Supports filtering by content type and URL patterns.',
    inputSchema: z.object({
      filename: z.string().optional().describe('File name to save the HAR to. Defaults to `session-{timestamp}.har` if not specified.'),
      contentTypes: z.array(z.string()).optional().describe('Array of MIME types to include (e.g., ["application/javascript", "text/css"]). If not specified, all content types are included.'),
      urlPattern: z.string().optional().describe('URL pattern to match (supports wildcards with * and ?). Only requests matching this pattern will be included. If not specified, all URLs are included.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, args) => {
    const filename = args.filename || `session-${new Date().toISOString().replace(/[:.]/g, '-')}.har`;
    const harPath = await outputFile(context.config, filename);

    // Ensure we have a browser context (creates one if needed)
    await context.ensureTab();

    // Get the HAR recorder
    const harRecorder = context.getHARRecorder();

    if (!harRecorder) {
      // This should not happen after ensureTab, but handle it just in case
      return {
        code: [],
        captureSnapshot: false,
        waitForNetwork: false,
        resultOverride: {
          content: [{
            type: 'text',
            text: `⚠️ HAR recording is not available. Failed to initialize browser context.`
          }]
        }
      };
    }

    // Generate and save HAR data with filtering if specified
    const filterOptions = {
      contentTypes: args.contentTypes,
      urlPattern: args.urlPattern
    };

    const harData = (args.contentTypes || args.urlPattern)
      ? harRecorder.generateFilteredHAR(filterOptions)
      : harRecorder.generateHAR();

    await fs.writeFile(harPath, JSON.stringify(harData, null, 2), 'utf-8');

    // Create result message with filter information
    const filterInfo = [];
    if (args.contentTypes && args.contentTypes.length > 0)
      filterInfo.push(`Content types: ${args.contentTypes.join(', ')}`);
    if (args.urlPattern)
      filterInfo.push(`URL pattern: ${args.urlPattern}`);

    const filterMessage = filterInfo.length > 0 ? `\nFilters applied: ${filterInfo.join('; ')}` : '';

    // Return success with resultOverride to bypass tab requirement
    return {
      code: [`await browserContext.saveHAR({ path: '${harPath}' });`],
      captureSnapshot: false,
      waitForNetwork: false,
      resultOverride: {
        content: [{
          type: 'text',
          text: `- Ran Playwright code:
\`\`\`js
await browserContext.saveHAR({ path: '${harPath}' });
\`\`\`

Saved HAR file to ${harPath}${filterMessage}`
        }]
      }
    };
  },
});

export default [
  save,
];
