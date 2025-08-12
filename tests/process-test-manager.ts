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
import { COMMON_REGEX_PATTERNS } from './test-utils.js';

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = nodeUrl.fileURLToPath(import.meta.url);

export interface SecureProcessOptions {
  args?: string[];
  noPort?: boolean;
  userDataDir?: string;
  headless?: boolean;
  timeout?: number;
}

export interface ProcessResult {
  url?: URL;
  stderr: () => string;
}

/**
 * Secure test process manager for spawning CLI processes with standardized security measures
 */
export class SecureTestProcessManager {
  private process: ChildProcess | undefined;
  private stderrBuffer = '';

  /**
   * Spawns a secure process with standardized environment and security options
   */
  async spawnSecureProcess(
    options: SecureProcessOptions = {}
  ): Promise<ProcessResult> {
    if (this.process) {
      throw new Error('Process already running');
    }

    const {
      args = [],
      noPort = false,
      userDataDir,
      headless = false,
      timeout = 30_000,
    } = options;

    // Security: Use absolute Node.js path instead of relying on PATH
    const nodeExecutable = process.execPath;

    const processArgs = [
      path.join(path.dirname(__filename), '../cli.js'),
      ...(noPort ? [] : ['--port=0']),
      ...(userDataDir ? [`--user-data-dir=${userDataDir}`] : []),
      ...(headless ? ['--headless'] : []),
      ...args,
    ];

    this.process = spawn(nodeExecutable, processArgs, {
      stdio: 'pipe',
      env: this.createSecureEnvironment(),
      timeout,
    });

    this.stderrBuffer = '';

    // Set up stderr capture
    this.process.stderr?.on('data', (data) => {
      this.stderrBuffer += data.toString();
    });

    // Wait for server to start if we expect a URL
    if (!noPort) {
      const url = await this.waitForServerStart();
      return { url: new URL(url), stderr: () => this.stderrBuffer };
    }

    // For noPort case, still check if server starts (due to config file)
    try {
      const url = await this.waitForServerStart();
      return { url: new URL(url), stderr: () => this.stderrBuffer };
    } catch {
      // If no server starts, return without URL
      return { stderr: () => this.stderrBuffer };
    }
  }

  /**
   * Creates a secure environment configuration for process spawning
   */
  private createSecureEnvironment(): NodeJS.ProcessEnv {
    return {
      // Security: Explicitly set safe environment to prevent PATH injection
      // Using controlled environment without PATH for enhanced safety
      NODE_ENV: 'test',
      // PATH intentionally omitted for security - Node.js will use system default
      HOME: process.env.HOME,
      USER: process.env.USER,
      DEBUG: 'pw:mcp:test,pw:mcp:transport',
      DEBUG_COLORS: '0',
      DEBUG_HIDE_DATE: '1',
    };
  }

  /**
   * Waits for the server to start and returns the URL
   */
  private waitForServerStart(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout after 30 seconds'));
      }, 30_000);

      const checkBuffer = () => {
        const match = this.stderrBuffer.match(
          COMMON_REGEX_PATTERNS.LISTENING_ON
        );
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
        // Check for errors in stderr
        if (
          this.stderrBuffer.includes('error') ||
          this.stderrBuffer.includes('Error')
        ) {
          clearTimeout(timeout);
          reject(new Error(`Server startup error: ${this.stderrBuffer}`));
        }
      };

      // Check buffer immediately in case server already started
      checkBuffer();

      this.process?.stderr?.on('data', (_data) => {
        checkBuffer();
      });

      this.process?.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.process?.on('exit', (code) => {
        clearTimeout(timeout);
        reject(
          new Error(`Process exited with code ${code} before server started`)
        );
      });
    });
  }

  /**
   * Safely terminates the running process
   */
  terminate(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = undefined;
    }
  }

  /**
   * Checks if a process is currently running
   */
  isRunning(): boolean {
    return this.process !== undefined;
  }

  /**
   * Gets the stderr buffer content
   */
  getStderr(): string {
    return this.stderrBuffer;
  }
}
