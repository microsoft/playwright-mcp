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

import { test, expect } from "@playwright/test";
import { createAuthenticatedHandler } from "../src/server";
import type { HealthStatus } from "../src/server";
import http from "http";
import type { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";

// Mock MCP server
class MockServer implements MCPServer {
  async connect() {}
  setRequestHandler() {}
  setNotificationHandler() {}
  setErrorHandler() {}
  sendNotification() {}
  close() {}
}

test.describe("health dashboard", () => {
  test("GET / returns health dashboard HTML", async () => {
    const mockServer = new MockServer();
    const handler = createAuthenticatedHandler(mockServer, {
      version: "1.0.0",
      capabilities: { vision: true, pdf: false },
      browsers: { chromium: "ready", firefox: "unavailable" },
      config: { snapshotMode: "pruned" },
      enableDashboard: true,
    });

    const server = http.createServer(handler);
    const port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      const response = await fetch(`http://localhost:${port}/`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain("Playwright MCP Health Dashboard");
      expect(html).toContain("Live Log");
      expect(html).toContain("updateDashboard");
      expect(html).toContain("api/health");
    } finally {
      server.close();
    }
  });

  test("GET /api/health returns JSON with correct structure", async () => {
    const mockServer = new MockServer();
    const handler = createAuthenticatedHandler(mockServer, {
      version: "1.0.0",
      capabilities: { vision: true, pdf: false },
      browsers: {
        chromium: "ready",
        firefox: "unavailable",
        webkit: "unavailable",
      },
      config: { snapshotMode: "pruned", snapshotDepth: 3 },
      authToken: "test-token",
    });

    const server = http.createServer(handler);
    const port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );

      const data = (await response.json()) as HealthStatus;

      // Verify structure
      expect(data.status).toBe("ok");
      expect(data.version).toBe("1.0.0");
      expect(typeof data.uptime_seconds).toBe("number");
      expect(data.auth_enabled).toBe(true);

      // Verify capabilities
      expect(data.capabilities.vision).toBe(true);
      expect(data.capabilities.pdf).toBe(false);

      // Verify browsers
      expect(data.browsers.chromium).toBe("ready");
      expect(data.browsers.firefox).toBe("unavailable");
      expect(data.browsers.webkit).toBe("unavailable");

      // Verify config
      expect(data.config.snapshotMode).toBe("pruned");
      expect(data.config.snapshotDepth).toBe(3);

      // Verify metrics
      expect(typeof data.metrics.requestsToday).toBe("number");
      expect(typeof data.metrics.avgResponseMs).toBe("number");

      // Verify log tail
      expect(Array.isArray(data.log_tail)).toBe(true);
    } finally {
      server.close();
    }
  });

  test("health endpoint metrics track requests", async () => {
    const mockServer = new MockServer();
    const handler = createAuthenticatedHandler(mockServer, {
      version: "1.0.0",
    });

    const server = http.createServer(handler);
    const port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      // Make first request
      let response = await fetch(`http://localhost:${port}/api/health`);
      let data = (await response.json()) as HealthStatus;
      const initialCount = data.metrics.requestsToday;

      // Make second request
      response = await fetch(`http://localhost:${port}/api/health`);
      data = (await response.json()) as HealthStatus;

      expect(data.metrics.requestsToday).toBeGreaterThanOrEqual(
        initialCount + 1,
      );
    } finally {
      server.close();
    }
  });

  test("health endpoint returns uptime in seconds", async () => {
    const mockServer = new MockServer();
    const handler = createAuthenticatedHandler(mockServer, {
      version: "1.0.0",
    });

    const server = http.createServer(handler);
    const port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      const data = (await response.json()) as HealthStatus;

      expect(typeof data.uptime_seconds).toBe("number");
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
    } finally {
      server.close();
    }
  });

  test("GET / with dashboard disabled returns 404", async () => {
    const mockServer = new MockServer();
    const handler = createAuthenticatedHandler(mockServer, {
      enableDashboard: false,
    });

    const server = http.createServer(handler);
    const port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      const response = await fetch(`http://localhost:${port}/`);
      expect(response.status).toBe(404);
    } finally {
      server.close();
    }
  });

  test("health API returns auth_enabled correctly", async () => {
    const mockServer = new MockServer();

    // Test with auth token
    let handler = createAuthenticatedHandler(mockServer, {
      authToken: "secret",
    });

    let server = http.createServer(handler);
    let port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      let response = await fetch(`http://localhost:${port}/api/health`);
      let data = (await response.json()) as HealthStatus;
      expect(data.auth_enabled).toBe(true);
    } finally {
      server.close();
    }

    // Test without auth token
    handler = createAuthenticatedHandler(mockServer, {});
    server = http.createServer(handler);
    port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      const data = (await response.json()) as HealthStatus;
      expect(data.auth_enabled).toBe(false);
    } finally {
      server.close();
    }
  });

  test("health endpoint includes empty log tail initially", async () => {
    const mockServer = new MockServer();
    const handler = createAuthenticatedHandler(mockServer, {
      version: "1.0.0",
    });

    const server = http.createServer(handler);
    const port = await new Promise<number>((resolve) => {
      const s = server.listen(0, () => {
        resolve((s.address() as any).port);
      });
    });

    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      const data = (await response.json()) as HealthStatus;

      expect(Array.isArray(data.log_tail)).toBe(true);
      // Should be empty or minimal initially
      expect(data.log_tail.length).toBeLessThanOrEqual(1);
    } finally {
      server.close();
    }
  });
});
