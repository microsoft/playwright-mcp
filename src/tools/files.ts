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
import os from 'os';
import path from 'path';

import { DownloadModalState, Tool, type ToolFactory } from './tool';
import { sanitizeForFilePath } from './utils';

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
    const modalState = context.modalStates().find(state => state.type === 'fileChooser');
    if (!modalState)
      throw new Error('No file chooser visible');

    const code = [
      `// <internal code to chose files ${validatedParams.paths.join(', ')}`,
    ];

    const action = async () => {
      await modalState.fileChooser.setFiles(validatedParams.paths);
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

const downloadFileSchema = z.object({
  filenames: z.array(z.string()).describe('The filenames to accept. All other files will be canceled.'),
});

const downloadFile: Tool = {
  capability: 'files',

  schema: {
    name: 'browser_file_download',
    description: 'Accept file downloads. Only use this if there is a download modal visible.',
    inputSchema: zodToJsonSchema(downloadFileSchema),
  },

  handle: async (context, params) => {
    const validatedParams = downloadFileSchema.parse(params);
    const modals = context.modalStates().filter(state => state.type === 'download');
    if (!modals.length)
      throw new Error('No download modal visible');

    const accepted = new Set<DownloadModalState>();
    for (const filename of validatedParams.filenames) {
      const download = modals.find(modal => modal.download.suggestedFilename() === filename);
      if (!download)
        throw new Error(`No download modal visible for file ${filename}`);
      accepted.add(download);
    }

    return {
      code: [`// <internal code to accept and cancel files>`],
      action: async () => {
        const text: string[] = [];
        await Promise.all(modals.map(async modal => {
          context.clearModalState(modal);

          if (!accepted.has(modal))
            return modal.download.cancel();

          const filePath = path.join(os.tmpdir(), sanitizeForFilePath(`download-${new Date().toISOString()}`), modal.download.suggestedFilename());
          try {
            await modal.download.saveAs(filePath);
            text.push(`Downloaded ${modal.download.suggestedFilename()} to ${filePath}`);
          } catch {
            text.push(`Failed to download ${modal.download.suggestedFilename()}`);
          }
        }));
        return { content: [{ type: 'text', text: text.join('\n') }] };
      },
      captureSnapshot: false,
      waitForNetwork: true,
    };
  },
  clearsModalState: 'download',
};

export default (captureSnapshot: boolean) => [
  uploadFile(captureSnapshot),
  downloadFile,
];
