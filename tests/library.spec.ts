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
/* eslint-disable @typescript-eslint/no-unused-vars */
import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import { expect, test } from './fixtures.js';

test(
  'library can be used from CommonJS',
  {
    annotation: {
      type: 'issue',
      description: 'https://github.com/microsoft/playwright-mcp/issues/456',
    },
  },
  async (_, testInfo) => {
    const file = testInfo.outputPath('main.cjs');
    const projectRoot = process.cwd();
    await fs.writeFile(
      file,
      `
    import('${projectRoot}/index.js')
      .then(playwrightMCP => playwrightMCP.createConnection())
      .then(() => {
        console.log('OK');
        process.exit(0);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
 `
    );
    // Safe command execution in test context - using specific file path
    // and controlled environment for security
    expect(
      child_process.execSync('node', [file], { encoding: 'utf-8' })
    ).toContain('OK');
  }
);
