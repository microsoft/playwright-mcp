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
import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.js';

test(
  'library can be used from CommonJS',
  {
    annotation: {
      type: 'issue',
      description: 'https://github.com/microsoft/playwright-mcp/issues/456',
    },
  },
  async ({ page: _page }, testInfo) => {
    const file = testInfo.outputPath('main.cjs');
    const projectRoot = process.cwd();

    // Normalize project root path for safe usage in import statement
    const normalizedProjectRoot = path.resolve(projectRoot);

    await fs.writeFile(
      file,
      `
    import('${normalizedProjectRoot}/index.js')
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

    // Verify generated file exists
    await fs.access(file);

    // Execute test file using spawnSync for security (no shell injection)
    const result = child_process.spawnSync(process.execPath, [file], {
      encoding: 'utf-8',
      cwd: testInfo.outputDir,
      shell: false,
      env: { NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
    });

    expect(result.stdout).toContain('OK');
  }
);
