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

import type { Request, Response, BrowserContext } from 'playwright';

export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
    headersSize: number;
    bodySize: number;
  };
  cache: {};
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    send: number;
    wait: number;
    receive: number;
    ssl: number;
  };
}

export interface HAR {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    pages: Array<{
      startedDateTime: string;
      id: string;
      title: string;
      pageTimings: {
        onContentLoad: number;
        onLoad: number;
      };
    }>;
    entries: HAREntry[];
  };
}

export class HARRecorder {
  private entries: HAREntry[] = [];
  private requestTimings = new Map<Request, { startTime: number }>();

  constructor(private browserContext: BrowserContext) {
    this.setupListeners();
  }

  private setupListeners() {
    this.browserContext.on('request', (request) => {
      this.requestTimings.set(request, { startTime: Date.now() });
    });

    this.browserContext.on('response', async (response) => {
      const request = response.request();
      const timing = this.requestTimings.get(request);
      if (!timing) return;

      const endTime = Date.now();
      const duration = endTime - timing.startTime;

      try {
        const entry = await this.createHAREntry(request, response, timing.startTime, duration);
        this.entries.push(entry);
      } catch (error) {
        // Ignore errors in HAR entry creation
      } finally {
        this.requestTimings.delete(request);
      }
    });

    this.browserContext.on('requestfailed', (request) => {
      // Clean up timing data for failed requests
      this.requestTimings.delete(request);
    });
  }

  private async createHAREntry(request: Request, response: Response, startTime: number, duration: number): Promise<HAREntry> {
    const url = new URL(request.url());
    const queryString = Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value }));

    const requestHeaders = await request.allHeaders();
    const responseHeaders = await response.allHeaders();
    const requestContentType = await request.headerValue('content-type');
    const responseContentType = await response.headerValue('content-type');

    let postData: { mimeType: string; text: string } | undefined;
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      const postDataBuffer = request.postDataBuffer();
      if (postDataBuffer) {
        postData = {
          mimeType: requestContentType || 'application/octet-stream',
          text: postDataBuffer.toString('base64')
        };
      }
    }

    return {
      startedDateTime: new Date(startTime).toISOString(),
      time: duration,
      request: {
        method: request.method(),
        url: request.url(),
        httpVersion: 'HTTP/1.1', // Playwright doesn't expose HTTP version
        headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value })),
        queryString,
        postData,
        headersSize: -1, // Not available in Playwright
        bodySize: postData ? Buffer.byteLength(postData.text, 'base64') : 0
      },
      response: {
        status: response.status(),
        statusText: response.statusText(),
        httpVersion: 'HTTP/1.1', // Playwright doesn't expose HTTP version
        headers: Object.entries(responseHeaders).map(([name, value]) => ({ name, value })),
        content: {
          size: -1, // Will be calculated from body if available
          mimeType: responseContentType || 'application/octet-stream',
        },
        headersSize: -1, // Not available in Playwright
        bodySize: -1 // Not easily available in Playwright
      },
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: -1,
        wait: duration, // Simplified - actual wait time
        receive: -1,
        ssl: -1
      }
    };
  }

  generateHAR(): HAR {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Playwright MCP',
          version: '1.0.0'
        },
        pages: [], // Pages are not tracked in this implementation
        entries: this.entries
      }
    };
  }

  clear() {
    this.entries = [];
    this.requestTimings.clear();
  }
}