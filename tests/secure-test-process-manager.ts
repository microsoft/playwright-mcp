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

import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import nodeUrl from 'node:url';
import type { TestInfo } from '@playwright/test';
import { COMMON_REGEX_PATTERNS } from './test-utils.js';

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = nodeUrl.fileURLToPath(import.meta.url);

export interface SecureProcessOptions {
  args?: string[];
  userDataDir?: string;
  mcpHeadless?: boolean;
  additionalEnv?: Record<string, string>;
}

export interface ProcessResult {
  url: URL;
  process: ChildProcess;
  stderr: () => string;
}

/**
 * Enhanced SecureTestProcessManager with cleanup and multiple process support
 */
export class SecureTestProcessManager {
  private processes: Map<ChildProcess, string> = new Map();

  /**
   * Gets the count of active processes
   */
  get activeProcessCount(): number {
    return this.processes.size;
  }

  /**
   * Spawns a process and waits for endpoint
   */
  async spawnAndWaitForEndpoint(
    options: SecureProcessOptions
  ): Promise<ProcessResult> {
    const nodeExecutable = process.execPath;
    const processArgs = [
      path.join(path.dirname(__filename), '../cli.js'),
      '--port=0',
      ...(options.userDataDir
        ? [`--user-data-dir=${options.userDataDir}`]
        : []),
      ...(options.mcpHeadless ? ['--headless'] : []),
      ...(options.args || []),
    ];

    const childProcess = spawn(nodeExecutable, processArgs, {
      stdio: 'pipe',
      env: this.createSecureEnvironment(options.additionalEnv),
    });

    let stderrBuffer = '';
    let stdoutBuffer = '';

    const urlPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout after 30 seconds'));
      }, 30_000);

      const checkForUrl = (data: string) => {
        const match = data.match(COMMON_REGEX_PATTERNS.LISTENING_ON);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      };

      childProcess.stderr?.on('data', (data) => {
        const str = data.toString();
        stderrBuffer += str;
        checkForUrl(stderrBuffer);
      });

      childProcess.stdout?.on('data', (data) => {
        const str = data.toString();
        stdoutBuffer += str;
        checkForUrl(stdoutBuffer);
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      childProcess.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });

    const url = await urlPromise;
    this.processes.set(childProcess, `${stderrBuffer}\n${stdoutBuffer}`);

    return {
      url: new URL(url),
      process: childProcess,
      stderr: () =>
        this.processes.get(childProcess) || `${stderrBuffer}\n${stdoutBuffer}`,
    };
  }

  /**
   * Spawns a secure process
   */
  spawnSecureProcess(
    options: SecureProcessOptions
  ): Omit<ProcessResult, 'url'> & { url?: URL } {
    const nodeExecutable = process.execPath;
    const processArgs = [
      path.join(path.dirname(__filename), '../cli.js'),
      ...(options.userDataDir
        ? [`--user-data-dir=${options.userDataDir}`]
        : []),
      ...(options.args || []),
    ];

    const childProcess = spawn(nodeExecutable, processArgs, {
      stdio: 'pipe',
      env: this.createSecureEnvironment(options.additionalEnv),
    });

    let stderrBuffer = '';
    childProcess.stderr?.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    this.processes.set(childProcess, stderrBuffer);

    return {
      process: childProcess,
      stderr: () => this.processes.get(childProcess) || stderrBuffer,
    };
  }

  /**
   * Terminates a specific process
   */
  terminateProcess(process: ChildProcess): void {
    if (this.processes.has(process)) {
      process.kill('SIGTERM');
      this.processes.delete(process);
    }
  }

  /**
   * Terminates all processes
   */
  terminateAllProcesses(): void {
    for (const process of this.processes.keys()) {
      process.kill('SIGTERM');
    }
    this.processes.clear();
  }

  /**
   * Cleanup all processes
   */
  cleanup(): void {
    // Delegate to terminateAllProcesses for consistency
    this.terminateAllProcesses();
  }

  /**
   * Extracts listening URL from stderr/stdout output
   */
  extractListeningUrl(output: string): string | null {
    const match = output.match(COMMON_REGEX_PATTERNS.LISTENING_ON);
    return match ? match[1] : null;
  }

  /**
   * Creates a server endpoint fixture for tests
   */
  createServerEndpointFixture(testInfo: TestInfo, headless: boolean) {
    return async (options: { args?: string[] }) => {
      const userDataDir = testInfo.outputPath('user-data-dir');
      const result = await this.spawnAndWaitForEndpoint({
        args: options.args,
        userDataDir,
        mcpHeadless: headless,
      });
      return {
        url: result.url,
        stderr: result.stderr,
      };
    };
  }

  /**
   * Creates a secure environment configuration
   */
  private createSecureEnvironment(
    additionalEnv?: Record<string, string>
  ): NodeJS.ProcessEnv {
    return {
      NODE_ENV: 'test',
      HOME: process.env.HOME,
      USER: process.env.USER,
      DEBUG: 'pw:mcp:test,pw:mcp:transport',
      DEBUG_COLORS: '0',
      DEBUG_HIDE_DATE: '1',
      ...additionalEnv,
    };
  }
}
