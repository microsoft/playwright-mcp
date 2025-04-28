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

export type ToolCapability = 'core' | 'tabs' | 'pdf' | 'history' | 'wait' | 'files' | 'install';

export type Config = {
  /**
   * The browser to use.
   */
  browser?: {
    /**
     * The type of browser to use.
     */
    type?: 'chrome' | 'chrome-beta' | 'chrome-canary' | 'chrome-dev' | 'chromium' | 'msedge' | 'msedge-beta' | 'msedge-canary' | 'msedge-dev' | 'firefox' | 'webkit';

    /**
     * Path to a custom browser executable.
     */
    executablePath?: string;

    /**
     * Path to a user data directory for browser profile persistence.
     */
    userDataDir?: string;

    /**
     * Whether to run the browser in headless mode (default: true).
     */
    headless?: boolean;

    /**
     * Chrome DevTools Protocol endpoint to connect to an existing browser instance in case of Chromium family browsers.
     */
    cdpEndpoint?: string;

    /**
     * Remote endpoint to connect to an existing Playwright server.
     */
    remoteEndpoint?: string;
  },

  server?: {
    /**
     * The port to listen on for SSE or MCP transport.
     */
    port?: number;

    /**
     * The host to bind the server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.
     */
    host?: string;
  },

  /**
   * List of enabled tool capabilities. Possible values:
   *   - 'core': Core browser automation features.
   *   - 'tabs': Tab management features.
   *   - 'pdf': PDF generation and manipulation.
   *   - 'history': Browser history access.
   *   - 'wait': Wait and timing utilities.
   *   - 'files': File upload/download support.
   *   - 'install': Browser installation utilities.
   */
  capabilities?: ToolCapability[];

  /**
   * Run server that uses screenshots (Aria snapshots are used by default).
   */
  vision?: boolean;

  /**
   * The directory to save output files.
   */
  outputDir?: string;
};
