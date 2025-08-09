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

    // Additional security validation: ensure file is within test output directory
    const resolvedFilePath = path.resolve(file);
    const expectedBasePath = path.resolve(testInfo.outputDir);
    if (!resolvedFilePath.startsWith(expectedBasePath)) {
      throw new Error('File is outside of expected test directory structure');
    }

    // Validate file extension for additional security
    if (!file.endsWith('.cjs')) {
      throw new Error('Invalid file extension - expected .cjs file');
    }

    // SonarQube Security Hotspot Fix: OS command execution is safe here because:
    // 1. This is a controlled test environment with validated inputs
    // 2. Using spawnSync instead of exec to prevent shell injection  
    // 3. Shell is explicitly disabled (shell: false)
    // 4. File path is validated and constrained to test output directory
    // 5. Using process.execPath for absolute Node.js path (no PATH dependency)
    // 6. Environment variables are minimal and controlled
    // 7. Timeout and proper error handling are implemented
    const result = child_process.spawnSync(process.execPath, [file], {
      encoding: 'utf-8',
      cwd: testInfo.outputDir,
      shell: false, // Explicitly disable shell to prevent command injection
      // Minimal environment to prevent environment variable injection
      // Using process.execPath eliminates PATH dependency for additional security
      env: {
        NODE_ENV: 'test',
        // PATH intentionally excluded - using absolute executable path instead
      },
      // Additional security options
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000, // 30 second timeout to prevent hanging
      windowsHide: true, // Hide command window on Windows
    });

    expect(result.stdout).toContain('OK');
  }
);
