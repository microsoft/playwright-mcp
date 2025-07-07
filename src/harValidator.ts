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

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { HAR } from './harRecorder.js';

const harSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    log: {
      type: 'object',
      properties: {
        version: {
          type: 'string',
          enum: ['1.2']
        },
        creator: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            comment: { type: 'string' }
          },
          required: ['name', 'version']
        },
        browser: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            comment: { type: 'string' }
          },
          required: ['name', 'version']
        },
        pages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startedDateTime: { type: 'string', format: 'date-time' },
              id: { type: 'string' },
              title: { type: 'string' },
              pageTimings: {
                type: 'object',
                properties: {
                  onContentLoad: { type: 'number' },
                  onLoad: { type: 'number' },
                  comment: { type: 'string' }
                }
              },
              comment: { type: 'string' }
            },
            required: ['startedDateTime', 'id', 'title', 'pageTimings']
          }
        },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pageref: { type: 'string' },
              startedDateTime: { type: 'string', format: 'date-time' },
              time: { type: 'number', minimum: 0 },
              request: {
                type: 'object',
                properties: {
                  method: { type: 'string' },
                  url: { type: 'string', format: 'uri' },
                  httpVersion: { type: 'string' },
                  cookies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        path: { type: 'string' },
                        domain: { type: 'string' },
                        expires: { type: 'string', format: 'date-time' },
                        httpOnly: { type: 'boolean' },
                        secure: { type: 'boolean' },
                        comment: { type: 'string' }
                      },
                      required: ['name', 'value']
                    }
                  },
                  headers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        comment: { type: 'string' }
                      },
                      required: ['name', 'value']
                    }
                  },
                  queryString: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        comment: { type: 'string' }
                      },
                      required: ['name', 'value']
                    }
                  },
                  postData: {
                    type: 'object',
                    properties: {
                      mimeType: { type: 'string' },
                      params: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            value: { type: 'string' },
                            fileName: { type: 'string' },
                            contentType: { type: 'string' },
                            comment: { type: 'string' }
                          },
                          required: ['name', 'value']
                        }
                      },
                      text: { type: 'string' },
                      encoding: { type: 'string' },
                      comment: { type: 'string' }
                    },
                    required: ['mimeType']
                  },
                  headersSize: { type: 'number' },
                  bodySize: { type: 'number' },
                  comment: { type: 'string' }
                },
                required: ['method', 'url', 'httpVersion', 'cookies', 'headers', 'queryString', 'headersSize', 'bodySize']
              },
              response: {
                type: 'object',
                properties: {
                  status: { type: 'number' },
                  statusText: { type: 'string' },
                  httpVersion: { type: 'string' },
                  cookies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        path: { type: 'string' },
                        domain: { type: 'string' },
                        expires: { type: 'string', format: 'date-time' },
                        httpOnly: { type: 'boolean' },
                        secure: { type: 'boolean' },
                        comment: { type: 'string' }
                      },
                      required: ['name', 'value']
                    }
                  },
                  headers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        comment: { type: 'string' }
                      },
                      required: ['name', 'value']
                    }
                  },
                  content: {
                    type: 'object',
                    properties: {
                      size: { type: 'number' },
                      compression: { type: 'number' },
                      mimeType: { type: 'string' },
                      text: { type: 'string' },
                      encoding: { type: 'string' },
                      comment: { type: 'string' }
                    },
                    required: ['size', 'mimeType']
                  },
                  redirectURL: { type: 'string' },
                  headersSize: { type: 'number' },
                  bodySize: { type: 'number' },
                  comment: { type: 'string' },
                  _transferSize: { type: 'number' }
                },
                required: ['status', 'statusText', 'httpVersion', 'cookies', 'headers', 'content', 'redirectURL', 'headersSize', 'bodySize']
              },
              cache: {
                type: 'object',
                properties: {
                  beforeRequest: {
                    type: 'object',
                    properties: {
                      expires: { type: 'string', format: 'date-time' },
                      lastAccess: { type: 'string', format: 'date-time' },
                      eTag: { type: 'string' },
                      hitCount: { type: 'number' },
                      comment: { type: 'string' }
                    },
                    required: ['lastAccess', 'eTag', 'hitCount']
                  },
                  afterRequest: {
                    type: 'object',
                    properties: {
                      expires: { type: 'string', format: 'date-time' },
                      lastAccess: { type: 'string', format: 'date-time' },
                      eTag: { type: 'string' },
                      hitCount: { type: 'number' },
                      comment: { type: 'string' }
                    },
                    required: ['lastAccess', 'eTag', 'hitCount']
                  },
                  comment: { type: 'string' }
                }
              },
              timings: {
                type: 'object',
                properties: {
                  blocked: { type: 'number' },
                  dns: { type: 'number' },
                  connect: { type: 'number' },
                  send: { type: 'number' },
                  wait: { type: 'number' },
                  receive: { type: 'number' },
                  ssl: { type: 'number' },
                  comment: { type: 'string' }
                },
                required: ['send', 'wait', 'receive']
              },
              serverIPAddress: { type: 'string' },
              connection: { type: 'string' },
              comment: { type: 'string' }
            },
            required: ['startedDateTime', 'time', 'request', 'response', 'cache', 'timings']
          }
        },
        comment: { type: 'string' }
      },
      required: ['version', 'creator', 'entries']
    }
  },
  required: ['log']
};

export class HARValidator {
  private ajv: any;
  private validate: any;

  constructor() {
    this.ajv = new (Ajv as any)({ allErrors: true });
    (addFormats as any)(this.ajv);
    this.validate = this.ajv.compile(harSchema);
  }

  validateHAR(har: HAR): { valid: boolean; errors: string[] } {
    const valid = this.validate(har);
    const errors: string[] = [];

    if (!valid && this.validate.errors) {
      for (const error of this.validate.errors)
        errors.push(`${error.instancePath} ${error.message}`);

    }

    return { valid, errors };
  }

  validateHARString(harString: string): { valid: boolean; errors: string[] } {
    try {
      const har = JSON.parse(harString);
      return this.validateHAR(har);
    } catch (parseError) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`]
      };
    }
  }
}
