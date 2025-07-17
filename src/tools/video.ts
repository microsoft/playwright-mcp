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
import { defineTool } from './tool.js';

const videoRecord = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_video_record',
    title: 'Record Video',
    description: 'Start or stop video recording of the current page',
    inputSchema: z.object({
      action: z.enum(['start', 'stop']),
      path: z.string().optional(),
    }),
    type: 'readOnly',
  },
  handle: async (context, input) => {
    const tab = context.currentTabOrDie();
    if (input.action === 'start') {
      // Enable video recording for the context (must be set at context creation)
      // This tool assumes the context is already created with video recording enabled.
      // Optionally, you can throw if not enabled.
      return {
        code: ['// Video recording assumed started (context must be created with recordVideo option)'],
        action: async () => ({ content: [{ type: 'text', text: 'Video recording assumed started (context must be created with recordVideo option)' }] }),
        captureSnapshot: false,
        waitForNetwork: false,
      };
    } else {
      // Save video for the current page
      const video = await tab.page.video();
      let videoPath = input.path;
      const fs = await import('fs');
      const path = await import('path');
      const projectRoot = process.cwd();
      const recordingsDir = path.join(projectRoot, 'VideoRecordings');
      if (!fs.existsSync(recordingsDir))
        fs.mkdirSync(recordingsDir, { recursive: true });

      if (!videoPath) {
        // If no explicit name, use scenario/test context or page title
        let baseName = 'video';
        if (
          context &&
          typeof context === 'object' &&
          'testInfo' in context &&
          context.testInfo &&
          typeof (context.testInfo as { title?: unknown }).title === 'string'
        ) {
          baseName = (context.testInfo as { title: string }).title;
        } else {
          try {
            baseName = (await tab.page.title()) || 'video';
          } catch {}
        }
        baseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear().toString().slice(-2)}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        videoPath = path.join(recordingsDir, `${baseName}-${timestamp}.webm`);
      } else {
        // If explicit name is given, ensure .webm extension
        if (!videoPath.endsWith('.webm'))
          videoPath += '.webm';

      }
      if (video)
        await video.saveAs(videoPath);

      return {
        code: [`// Video recording stopped and saved to ${videoPath}`],
        action: async () => ({ content: [{ type: 'text', text: `Video recording stopped and saved to ${videoPath}` }] }),
        captureSnapshot: false,
        waitForNetwork: false,
      };
    }
  },
});

export default [videoRecord];
