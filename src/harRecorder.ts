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
import { HARValidator } from './harValidator.js';

export interface HARCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  comment?: string;
}

export interface HARPostData {
  mimeType: string;
  params?: Array<{ name: string; value: string; fileName?: string; contentType?: string; comment?: string }>;
  text?: string;
  encoding?: string;
  comment?: string;
}

export interface HARContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  comment?: string;
}

export interface HARCache {
  beforeRequest?: {
    expires?: string;
    lastAccess: string;
    eTag: string;
    hitCount: number;
    comment?: string;
  };
  afterRequest?: {
    expires?: string;
    lastAccess: string;
    eTag: string;
    hitCount: number;
    comment?: string;
  };
  comment?: string;
}

export interface HARTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
  comment?: string;
}

export interface HAREntry {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    cookies: HARCookie[];
    headers: Array<{ name: string; value: string; comment?: string }>;
    queryString: Array<{ name: string; value: string; comment?: string }>;
    postData?: HARPostData;
    headersSize: number;
    bodySize: number;
    comment?: string;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    cookies: HARCookie[];
    headers: Array<{ name: string; value: string; comment?: string }>;
    content: HARContent;
    redirectURL: string;
    headersSize: number;
    bodySize: number;
    comment?: string;
    _transferSize?: number;
  };
  cache: HARCache | {};
  timings: HARTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}

export interface HARCreator {
  name: string;
  version: string;
  comment?: string;
}

export interface HARBrowser {
  name: string;
  version: string;
  comment?: string;
}

export interface HARPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: {
    onContentLoad?: number;
    onLoad?: number;
    comment?: string;
  };
  comment?: string;
}

export interface HARLog {
  version: string;
  creator: HARCreator;
  browser?: HARBrowser;
  pages?: HARPage[];
  entries: HAREntry[];
  comment?: string;
}

export interface HAR {
  log: HARLog;
}

export class HARRecorder {
  private entries: HAREntry[] = [];
  private requestTimings = new Map<Request, { startTime: number }>();
  private validator = new HARValidator();

  constructor(private browserContext: BrowserContext) {
    this.setupListeners();
  }

  private setupListeners() {
    this.browserContext.on('request', request => {
      this.requestTimings.set(request, { startTime: Date.now() });
    });

    this.browserContext.on('response', async response => {
      const request = response.request();
      const timing = this.requestTimings.get(request);
      if (!timing)
        return;

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

    this.browserContext.on('requestfailed', request => {
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

    // Extract cookies from headers
    const requestCookies = this.parseCookiesFromHeaders(requestHeaders);
    const responseCookies = this.parseSetCookiesFromHeaders(responseHeaders);

    let postData: HARPostData | undefined;
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      const postDataBuffer = request.postDataBuffer();
      if (postDataBuffer) {
        const mimeType = requestContentType || 'application/octet-stream';
        const isTextContent = this.isTextMimeType(mimeType);

        postData = {
          mimeType,
          text: isTextContent ? postDataBuffer.toString('utf8') : postDataBuffer.toString('base64'),
          encoding: isTextContent ? undefined : 'base64'
        };
      }
    }

    // Calculate body sizes
    const requestBodySize = postData ? (postData.text ? Buffer.byteLength(postData.text, postData.encoding === 'base64' ? 'base64' : 'utf8') : 0) : 0;

    return {
      startedDateTime: new Date(startTime).toISOString(),
      time: duration,
      request: {
        method: request.method(),
        url: request.url(),
        httpVersion: 'HTTP/1.1', // Playwright doesn't expose HTTP version
        cookies: requestCookies,
        headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value })),
        queryString,
        postData,
        headersSize: -1, // Not available in Playwright
        bodySize: requestBodySize
      },
      response: {
        status: response.status(),
        statusText: response.statusText(),
        httpVersion: 'HTTP/1.1', // Playwright doesn't expose HTTP version
        cookies: responseCookies,
        headers: Object.entries(responseHeaders).map(([name, value]) => ({ name, value })),
        content: await this.captureResponseContent(response, responseContentType),
        redirectURL: responseHeaders['location'] || '', // Required field
        headersSize: -1, // Not available in Playwright
        bodySize: await this.getResponseBodySize(response)
      },
      cache: {}, // Empty object when no cache info available
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: Math.max(1, duration - 1), // Most of the time is waiting
        receive: 1, // Minimal receive time
        ssl: -1
      }
    };
  }

  private isTextMimeType(mimeType: string): boolean {
    return mimeType.includes('text/') ||
           mimeType.includes('application/json') ||
           mimeType.includes('application/xml') ||
           mimeType.includes('application/javascript') ||
           mimeType.includes('application/xhtml') ||
           mimeType.includes('application/x-www-form-urlencoded');
  }

  private async getResponseBodySize(response: Response): Promise<number> {
    try {
      const body = await response.body();
      return body.length;
    } catch {
      return -1;
    }
  }

  private async captureResponseContent(response: Response, responseContentType: string | null): Promise<HARContent> {
    try {
      const body = await response.body();
      const mimeType = responseContentType || 'application/octet-stream';
      const isTextContent = this.isTextMimeType(mimeType);

      if (isTextContent) {
        // Store as UTF-8 text
        const text = body.toString('utf8');
        return {
          size: Buffer.byteLength(text, 'utf8'),
          mimeType,
          text
        };
      } else {
        // Store binary content as base64
        const text = body.toString('base64');
        return {
          size: body.length,
          mimeType,
          text,
          encoding: 'base64'
        };
      }
    } catch (error) {
      // Response body not available or failed to read
      return {
        size: -1,
        mimeType: responseContentType || 'application/octet-stream'
      };
    }
  }

  private parseCookiesFromHeaders(headers: Record<string, string>): HARCookie[] {
    const cookieHeader = headers['cookie'];
    if (!cookieHeader)
      return [];

    return cookieHeader.split(';').map(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      return {
        name: name.trim(),
        value: valueParts.join('=').trim()
      };
    });
  }

  private parseSetCookiesFromHeaders(headers: Record<string, string>): HARCookie[] {
    const setCookieHeaders = headers['set-cookie'];
    if (!setCookieHeaders)
      return [];

    // Set-Cookie headers can be an array or a single string
    const cookies: HARCookie[] = [];
    const setCookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

    for (const setCookie of setCookieArray) {
      const parts = setCookie.split(';').map((p: string) => p.trim());
      const [nameValue, ...attributes] = parts;
      const [name, ...valueParts] = nameValue.split('=');

      const cookie: HARCookie = {
        name: name.trim(),
        value: valueParts.join('=').trim()
      };

      // Parse cookie attributes
      for (const attr of attributes) {
        const [attrName, attrValue] = attr.split('=').map((s: string) => s.trim());
        const lowerAttrName = attrName.toLowerCase();

        switch (lowerAttrName) {
          case 'path':
            cookie.path = attrValue;
            break;
          case 'domain':
            cookie.domain = attrValue;
            break;
          case 'expires':
            cookie.expires = new Date(attrValue).toISOString();
            break;
          case 'secure':
            cookie.secure = true;
            break;
          case 'httponly':
            cookie.httpOnly = true;
            break;
        }
      }

      cookies.push(cookie);
    }

    return cookies;
  }

  generateHAR(): HAR {
    const har: HAR = {
      log: {
        version: '1.2',
        creator: {
          name: 'Playwright MCP',
          version: '1.0.0',
          comment: 'HAR exported by Playwright MCP Server'
        },
        browser: {
          name: 'Playwright',
          version: this.getPlaywrightVersion(),
          comment: `Browser: ${this.getBrowserName()}`
        },
        pages: [], // Pages are not tracked in this implementation
        entries: this.entries,
        comment: ''
      }
    };

    // Validate the HAR before returning
    const validation = this.validator.validateHAR(har);
    if (!validation.valid) {
      // HAR validation failed - log errors in development mode
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Generated HAR is not valid:', validation.errors);
      }
    }


    return har;
  }

  generateFilteredHAR(options: { contentTypes?: string[]; urlPattern?: string }): HAR {
    let filteredEntries = this.entries;

    // Filter by content types if specified
    if (options.contentTypes && options.contentTypes.length > 0) {
      filteredEntries = filteredEntries.filter(entry => {
        const mimeType = entry.response.content.mimeType;
        return options.contentTypes!.some(contentType =>
          mimeType.includes(contentType) || contentType.includes(mimeType)
        );
      });
    }

    // Filter by URL pattern if specified
    if (options.urlPattern) {
      const pattern = this.createUrlMatcher(options.urlPattern);
      filteredEntries = filteredEntries.filter(entry =>
        pattern.test(entry.request.url)
      );
    }

    const har: HAR = {
      log: {
        version: '1.2',
        creator: {
          name: 'Playwright MCP',
          version: '1.0.0',
          comment: 'HAR exported by Playwright MCP Server with filtering'
        },
        browser: {
          name: 'Playwright',
          version: this.getPlaywrightVersion(),
          comment: `Browser: ${this.getBrowserName()}`
        },
        pages: [], // Pages are not tracked in this implementation
        entries: filteredEntries,
        comment: this.createFilterComment(options)
      }
    };

    // Validate the HAR before returning
    const validation = this.validator.validateHAR(har);
    if (!validation.valid) {
      // HAR validation failed - log errors in development mode
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Generated filtered HAR is not valid:', validation.errors);
      }
    }

    return har;
  }

  private createUrlMatcher(pattern: string): RegExp {
    // Convert wildcard pattern to regex
    // Escape special regex characters except * and ?
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');

    return new RegExp(`^${escaped}$`, 'i');
  }

  private createFilterComment(options: { contentTypes?: string[]; urlPattern?: string }): string {
    const filters: string[] = [];

    if (options.contentTypes && options.contentTypes.length > 0)
      filters.push(`Content types: ${options.contentTypes.join(', ')}`);

    if (options.urlPattern)
      filters.push(`URL pattern: ${options.urlPattern}`);

    return filters.length > 0 ? `Filtered by: ${filters.join('; ')}` : '';
  }

  private getPlaywrightVersion(): string {
    try {
      // Try to get Playwright version from package.json or environment
      return process.env.PLAYWRIGHT_VERSION || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private getBrowserName(): string {
    try {
      // Get browser name from context if available
      const browserName = (this.browserContext as any)._browser?.name?.() || 'unknown';
      return browserName;
    } catch {
      return 'unknown';
    }
  }

  clear() {
    this.entries = [];
    this.requestTimings.clear();
  }
}
