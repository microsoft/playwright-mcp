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

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { outputFile } from '../config.js';
import { defineTool } from './tool.js';

const getVideoPath = defineTool({
  capability: 'core',
  schema: {
    name: 'get_video_path',
    title: 'Get video path',
    description: 'Get the path to the video recording for the current or specified tab. Returns the video file path if recording is enabled.',
    inputSchema: z.object({
      tabIndex: z.number().min(1).optional().describe('Tab index (1-based). If not provided, uses the current tab.'),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => {
    const tab = params.tabIndex ? context.tabs()[params.tabIndex - 1] : context.currentTabOrDie();
    if (!tab)
      throw new Error(`Tab ${params.tabIndex} not found`);

    // Get video from the page
    const video = tab.page.video();
    if (!video) {
      throw new Error('Video recording is not enabled for this tab. Enable video recording in the browser configuration.');
    }

    const videoPath = await video.path();
    const code = [
      `// Getting video path for tab ${params.tabIndex || 'current'}`,
      `// Video path: ${videoPath}`,
    ];

    return {
      code,
      content: [
        {
          type: 'text',
          text: `Video recording path: ${videoPath}`,
        },
      ],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const saveVideo = defineTool({
  capability: 'core',
  schema: {
    name: 'save_video',
    title: 'Save video',
    description: 'Save the video recording for the current or specified tab to the output directory.',
    inputSchema: z.object({
      tabIndex: z.number().min(1).optional().describe('Tab index (1-based). If not provided, uses the current tab.'),
      filename: z.string().optional().describe('Custom filename for the saved video (without extension). If not provided, uses a default name.'),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => {
    const tab = params.tabIndex ? context.tabs()[params.tabIndex - 1] : context.currentTabOrDie();
    if (!tab)
      throw new Error(`Tab ${params.tabIndex} not found`);

    const video = tab.page.video();
    if (!video) {
      throw new Error('Video recording is not enabled for this tab. Enable video recording in the browser configuration.');
    }

    const originalPath = await video.path();
    const filename = params.filename || `video-${Date.now()}`;
    const outputPath = await outputFile(context.config, `${filename}.webm`);

    // Copy the video file to the output directory
    await fs.promises.copyFile(originalPath, outputPath);

    const code = [
      `// Saving video for tab ${params.tabIndex || 'current'}`,
      `// Saved to: ${outputPath}`,
    ];

    return {
      code,
      content: [
        {
          type: 'text',
          text: `Video saved to: ${outputPath}`,
        },
      ],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const listVideoFiles = defineTool({
  capability: 'core',
  schema: {
    name: 'list_video_files',
    title: 'List video files',
    description: 'List all video files in the output directory.',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async (context) => {
    const outputDir = context.config.outputDir;
    
    try {
      const files = await fs.promises.readdir(outputDir);
      const videoFiles = files.filter(file => 
        file.endsWith('.webm') || file.endsWith('.mp4') || file.endsWith('.avi')
      );

      if (videoFiles.length === 0) {
        return {
          code: ['// No video files found in output directory'],
          content: [
            {
              type: 'text',
              text: 'No video files found in the output directory.',
            },
          ],
          captureSnapshot: false,
          waitForNetwork: false,
        };
      }

      const videoList = videoFiles.map((file, index) => {
        const fullPath = path.join(outputDir, file);
        return `${index + 1}. ${file} (${fullPath})`;
      }).join('\n');

      const code = [
        `// Found ${videoFiles.length} video file(s) in ${outputDir}`,
        ...videoFiles.map(file => `// - ${file}`),
      ];

      return {
        code,
        content: [
          {
            type: 'text',
            text: `Video files in output directory:\n${videoList}`,
          },
        ],
        captureSnapshot: false,
        waitForNetwork: false,
      };
    } catch (error) {
      return {
        code: [`// Error reading output directory: ${error}`],
        content: [
          {
            type: 'text',
            text: `Error reading output directory: ${error}`,
          },
        ],
        captureSnapshot: false,
        waitForNetwork: false,
      };
    }
  },
});

export default [getVideoPath, saveVideo, listVideoFiles];
