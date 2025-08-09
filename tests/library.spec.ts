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
  async ({ page }, testInfo) => {
    const file = testInfo.outputPath('main.cjs');
    const projectRoot = process.cwd();

    // Validate project root path for security
    if (!projectRoot?.startsWith('/')) {
      throw new Error('Invalid project root path');
    }

    // Sanitize project root path to prevent injection
    const sanitizedProjectRoot = projectRoot.replace(/['"\\$`]/g, '');

    await fs.writeFile(
      file,
      `
    import('${sanitizedProjectRoot}/index.js')
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

    // Validate file exists before execution for security
    const fileStats = await fs.stat(file);
    if (!fileStats.isFile()) {
      throw new Error('Generated file is not a valid file');
    }

    // Safe command execution in test context with enhanced security measures
    const result = child_process.spawnSync('node', [file], {
      encoding: 'utf-8',
      cwd: testInfo.outputDir,
      // Minimal environment to prevent environment variable injection
      env: {
        NODE_ENV: 'test',
        PATH: '/usr/bin:/bin:/usr/local/bin',
      },
      // Additional security options
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000, // 30 second timeout to prevent hanging
      windowsHide: true, // Hide command window on Windows
    });

    expect(result.stdout).toContain('OK');
  }
);
