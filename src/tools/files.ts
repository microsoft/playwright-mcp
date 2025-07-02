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
import { defineTool, type ToolFactory } from './tool.js';

const uploadFile: ToolFactory = captureSnapshot => defineTool({
  capability: 'files',

  schema: {
    name: 'browser_file_upload',
    title: 'Upload files',
    description: 'Upload one or multiple files',
    inputSchema: z.object({
      paths: z.array(z.string()).describe('The absolute paths to the files to upload. Can be a single file or multiple files.'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const modalState = context.modalStates().find(state => state.type === 'fileChooser');
    if (!modalState)
      throw new Error('No file chooser visible');

    const code = [
      `// <internal code to chose files ${params.paths.join(', ')}`,
    ];

    const action = async () => {
      await modalState.fileChooser.setFiles(params.paths);
      context.clearModalState(modalState);
    };

    return {
      code,
      action,
      captureSnapshot,
      waitForNetwork: true,
    };
  },
  clearsModalState: 'fileChooser',
});

export default (captureSnapshot: boolean) => [
  uploadFile(captureSnapshot),
];
