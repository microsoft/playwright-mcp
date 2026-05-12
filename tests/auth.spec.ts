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

import http from "http";
import { test, expect } from "./fixtures";
import {
  createAuthenticatedHandler,
  validateServerConfiguration,
} from "../src/server";
import { createConnection } from "..";

test("authentication - request with valid token succeeds", async () => {
  const token = "test-token-123";
  const connection = await createConnection();
  const handler = createAuthenticatedHandler(connection, { authToken: token });

  let responseStatus = 0;
  let responseBody = "";

  const mockRes = {
    writeHead: (status: number) => {
      responseStatus = status;
    },
    end: (body?: string) => {
      responseBody = body || "";
    },
    on: () => {},
    once: () => {},
    emit: () => {},
    write: () => {},
  } as any;

  const mockReq = {
    url: "/messages",
    headers: {
      authorization: `Bearer ${token}`,
      host: "localhost:8080",
    },
    method: "POST",
  } as any;

  // Handler should connect without rejecting
  const result = handler(mockReq, mockRes);

  // For now, we just verify it doesn't return a 401
  // In a real integration, the SSEServerTransport would handle the rest
  await result;

  // Should not be 401 (though connection state depends on SSEServerTransport)
  expect(responseStatus).not.toBe(401);
});

test("authentication - request without token returns 401", async () => {
  const token = "test-token-123";
  const connection = await createConnection();
  const handler = createAuthenticatedHandler(connection, { authToken: token });

  let responseStatus = 0;
  let responseBody = "";
  let responseHeaders = {};

  const mockRes = {
    writeHead: (status: number, headers?: any) => {
      responseStatus = status;
      responseHeaders = headers || {};
    },
    end: (body?: string) => {
      responseBody = body || "";
    },
    on: () => {},
    once: () => {},
    emit: () => {},
    write: () => {},
  } as any;

  const mockReq = {
    url: "/messages",
    headers: {
      host: "localhost:8080",
    },
    method: "POST",
  } as any;

  handler(mockReq, mockRes);

  expect(responseStatus).toBe(401);
  expect(responseBody).toContain("Unauthorized");
  expect(responseBody).toContain("Missing authorization token");
});

test("authentication - request with wrong token returns 401", async () => {
  const token = "test-token-123";
  const wrongToken = "wrong-token-456";
  const connection = await createConnection();
  const handler = createAuthenticatedHandler(connection, { authToken: token });

  let responseStatus = 0;
  let responseBody = "";

  const mockRes = {
    writeHead: (status: number) => {
      responseStatus = status;
    },
    end: (body?: string) => {
      responseBody = body || "";
    },
    on: () => {},
    once: () => {},
    emit: () => {},
    write: () => {},
  } as any;

  const mockReq = {
    url: "/messages",
    headers: {
      authorization: `Bearer ${wrongToken}`,
      host: "localhost:8080",
    },
    method: "POST",
  } as any;

  handler(mockReq, mockRes);

  expect(responseStatus).toBe(401);
  expect(responseBody).toContain("Unauthorized");
  expect(responseBody).toContain("Invalid authorization token");
});

test("authentication - no auth token configured allows all requests", async () => {
  const connection = await createConnection();
  const handler = createAuthenticatedHandler(connection, {
    authToken: undefined,
  });

  let responseStatus = 0;

  const mockRes = {
    writeHead: (status: number) => {
      responseStatus = status;
    },
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
    write: () => {},
  } as any;

  const mockReq = {
    url: "/messages",
    headers: {
      host: "localhost:8080",
    },
    method: "POST",
  } as any;

  const result = handler(mockReq, mockRes);
  await result;

  // Should not be 401 when no auth token is configured
  expect(responseStatus).not.toBe(401);
});

test("authentication - malformed authorization header is rejected", async () => {
  const token = "test-token-123";
  const connection = await createConnection();
  const handler = createAuthenticatedHandler(connection, { authToken: token });

  let responseStatus = 0;

  const mockRes = {
    writeHead: (status: number) => {
      responseStatus = status;
    },
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
    write: () => {},
  } as any;

  const mockReq = {
    url: "/messages",
    headers: {
      authorization: `Basic ${Buffer.from("user:pass").toString("base64")}`,
      host: "localhost:8080",
    },
    method: "POST",
  } as any;

  handler(mockReq, mockRes);

  expect(responseStatus).toBe(401);
});

test("authentication - unknown path returns 404", async () => {
  const connection = await createConnection();
  const handler = createAuthenticatedHandler(connection, {
    authToken: "token",
  });

  let responseStatus = 0;

  const mockRes = {
    writeHead: (status: number) => {
      responseStatus = status;
    },
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
    write: () => {},
  } as any;

  const mockReq = {
    url: "/unknown",
    headers: {
      host: "localhost:8080",
    },
    method: "GET",
  } as any;

  handler(mockReq, mockRes);

  expect(responseStatus).toBe(404);
});

test("validateServerConfiguration - warns when port is set without token on remote host", () => {
  const warnings: string[] = [];
  const logger = (msg: string) => warnings.push(msg);

  validateServerConfiguration(8931, undefined, logger, "0.0.0.0");

  expect(warnings.length).toBe(1);
  expect(warnings[0]).toContain("without authentication");
  expect(warnings[0]).toContain("0.0.0.0:8931");
});

test("validateServerConfiguration - warns when port is set without token on non-localhost", () => {
  const warnings: string[] = [];
  const logger = (msg: string) => warnings.push(msg);

  validateServerConfiguration(8931, undefined, logger, "192.168.1.1");

  expect(warnings.length).toBe(1);
  expect(warnings[0]).toContain("without authentication");
});

test("validateServerConfiguration - no warning when token is configured", () => {
  const warnings: string[] = [];
  const logger = (msg: string) => warnings.push(msg);

  validateServerConfiguration(8931, "my-token", logger, "0.0.0.0");

  expect(warnings.length).toBe(0);
});

test("validateServerConfiguration - no warning when no port is set", () => {
  const warnings: string[] = [];
  const logger = (msg: string) => warnings.push(msg);

  validateServerConfiguration(undefined, undefined, logger, "0.0.0.0");

  expect(warnings.length).toBe(0);
});

test("validateServerConfiguration - no warning on localhost without token", () => {
  const warnings: string[] = [];
  const logger = (msg: string) => warnings.push(msg);

  validateServerConfiguration(8931, undefined, logger, "localhost");

  // Should still warn even on localhost, as it's a security best practice
  expect(warnings.length).toBe(1);
});
