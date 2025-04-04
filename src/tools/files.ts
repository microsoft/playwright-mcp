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

import type { ToolFactory } from './tool';

const uploadFileSchema = z.object({
  paths: z.array(z.string()).describe('The absolute paths to the files to upload. Can be a single file or multiple files.'),
});

const uploadFile: ToolFactory = captureSnapshot => ({
  capability: 'files',
  schema: {
    name: 'browser_file_upload',
    description: 'Upload one or multiple files',
    inputSchema: zodToJsonSchema(uploadFileSchema),
  },
  handle: async (context, params) => {
    const validatedParams = uploadFileSchema.parse(params);
    const tab = context.currentTab();
    return await tab.runAndWait(async () => {
      await tab.submitFileChooser(validatedParams.paths);
    }, {
      status: `Chose files ${validatedParams.paths.join(', ')}`,
      captureSnapshot,
      noClearFileChooser: true,
    });
  },
});

export default (captureSnapshot: boolean) => [
  uploadFile(captureSnapshot),
];
