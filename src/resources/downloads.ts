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

import type { ResourceList } from './resource';

export const downloads: ResourceList = {
  subscribe: (context, onChanged) => context.onDownloadChanged(onChanged),
  list: async context => {
    return context.downloads().map(download => {
      const uri = `browser://downloads/${download.suggestedFilename()}`;
      return {
        schema: {
          uri,
          name: `Browser download: ${download.suggestedFilename()}`,
          description: `Downloaded from ${download.url()}`,
        },
        read: async (_context, uri) => {
          const chunks: Buffer[] = [];
          for await (const chunk of await download.createReadStream())
            chunks.push(chunk);

          return [{
            uri,
            mimeType: 'binary/octet-stream',
            blob: Buffer.concat(chunks).toString('base64'),
          }];
        },
      };
    });
  },
};
