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

import os from 'os';
import path from 'path';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { sanitizeForFilePath } from './utils';

import type { Tool } from './tool';

const pdfSchema = z.object({});

const pdf: Tool = {
  capability: 'pdf',
  schema: {
    name: 'browser_pdf_save',
    description: 'Save page as PDF',
    inputSchema: zodToJsonSchema(pdfSchema),
  },
  handle: async context => {
    const tab = context.currentTab();
    const fileName = path.join(os.tmpdir(), sanitizeForFilePath(`page-${new Date().toISOString()}`)) + '.pdf';
    await tab.page.pdf({ path: fileName });
    return {
      content: [{
        type: 'text',
        text: `Saved as ${fileName}`,
      }],
    };
  },
};

export default [
  pdf,
];
