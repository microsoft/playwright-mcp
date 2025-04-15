#!/usr/bin/env node
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

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

type ToolCapability = 'core' | 'tabs' | 'pdf' | 'history' | 'wait' | 'files' | 'install';

type Options = {
    /**
     * The browser to use (e.g., 'chrome', 'chromium', 'firefox', 'webkit', 'msedge').
     */
    browser?: string;
    /**
     * Path to a user data directory for browser profile persistence.
     */
    userDataDir?: string;
    /**
     * Whether to run the browser in headless mode (default: true).
     */
    headless?: boolean;
    /**
     * Path to a custom browser executable.
     */
    executablePath?: string;
    /**
     * Chrome DevTools Protocol endpoint to connect to an existing browser instance.
     */
    cdpEndpoint?: string;
    /**
     * Enable vision capabilities (e.g., visual automation or OCR).
     */
    vision?: boolean;
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
};
export declare function createServer(options?: Options): Promise<Server>;
export {};
