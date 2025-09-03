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

import fs from 'fs';
import { z } from '../mcp/bundle.js';
import { defineTabTool } from './tool';

const saveBlobSchema = z.object({
  blobUrl: z.string().optional().describe('Blob URL to save. If not provided, will attempt to find blob URLs in the current page.'),
  filename: z.string().optional().describe('File name only (not a full path) to save the blob to. The file will be automatically saved to the MCP server\'s configured output directory for security. You cannot specify arbitrary paths. Defaults to `blob-{timestamp}.{extension}` where extension is guessed from content type.'),
});

const saveBlob = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_save_blob',
    title: 'Save blob URL',
    description: 'Save content from a blob URL (e.g., PDFs opened in browser viewer) to a file',
    inputSchema: saveBlobSchema,
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    let targetBlobUrl = params.blobUrl;

    // If no blob URL provided, try to find one in the current page
    if (!targetBlobUrl) {
      const currentUrl = tab.page.url();
      if (currentUrl.startsWith('blob:')) {
        targetBlobUrl = currentUrl;
      } else {
        // Look for blob URLs in iframes or embed elements
        const foundBlobUrls = await tab.page.evaluate(() => {
          const blobUrls: string[] = [];

          // Check iframes
          const iframes = document.querySelectorAll('iframe');
          iframes.forEach(iframe => {
            const src = iframe.getAttribute('src');
            if (src && src.startsWith('blob:'))
              blobUrls.push(src);

          });

          // Check embed/object elements
          const embeds = document.querySelectorAll('embed, object');
          embeds.forEach(elem => {
            const src = elem.getAttribute('src') || elem.getAttribute('data');
            if (src && src.startsWith('blob:'))
              blobUrls.push(src);

          });

          return blobUrls;
        });

        if (foundBlobUrls.length > 0) {
          targetBlobUrl = foundBlobUrls[0];
          if (foundBlobUrls.length > 1)
            response.addResult(`Found ${foundBlobUrls.length} blob URLs, using the first one: ${targetBlobUrl}`);

        }
      }
    }

    if (!targetBlobUrl)
      throw new Error('No blob URL found. Please provide a blob URL or navigate to a page with blob content.');


    if (!targetBlobUrl.startsWith('blob:'))
      throw new Error('Provided URL is not a blob URL. Only blob: URLs are supported.');


    // Fetch blob content and convert to Base64
    response.addCode(`// Fetch blob content from ${targetBlobUrl}`);
    const result = await tab.page.evaluate(async blobUrl => {
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();

        return new Promise<{base64Data: string, contentType: string, size: number}>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve({
              base64Data,
              contentType: blob.type || 'application/octet-stream',
              size: blob.size
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        throw new Error(`Failed to fetch blob: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, targetBlobUrl);

    // Determine file extension from content type
    const getExtensionFromContentType = (contentType: string): string => {
      if (contentType.includes('pdf'))
        return 'pdf';
      if (contentType.includes('png'))
        return 'png';
      if (contentType.includes('jpeg') || contentType.includes('jpg'))
        return 'jpg';
      if (contentType.includes('gif'))
        return 'gif';
      if (contentType.includes('webp'))
        return 'webp';
      if (contentType.includes('svg'))
        return 'svg';
      if (contentType.includes('json'))
        return 'json';
      if (contentType.includes('text'))
        return 'txt';
      if (contentType.includes('html'))
        return 'html';
      return 'bin';
    };

    const extension = getExtensionFromContentType(result.contentType);
    const fileName = await tab.context.outputFile(
        params.filename ?? `blob-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`
    );

    // Convert Base64 to buffer and save file
    response.addCode(`const response = await fetch(blobUrl);
const blob = await response.blob();
// Convert blob to base64 and save to ${fileName}`);

    const buffer = Buffer.from(result.base64Data, 'base64');
    fs.writeFileSync(fileName, buffer);

    response.addResult(`Saved blob content to file (${result.size} bytes, ${result.contentType}). Full path: ${fileName}`);
  },
});

export default [
  saveBlob,
];
