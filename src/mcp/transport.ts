import crypto from 'node:crypto';
import type http from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import debug from 'debug';
import { httpAddressToString, startHttpServer } from '../httpServer.js';
import type { ServerBackendFactory } from './server.js';
import { connect } from './server.js';
export async function start(
  serverBackendFactory: ServerBackendFactory,
  options: { host?: string; port?: number }
) {
  if (options.port !== undefined) {
    const httpServer = await startHttpServer(options);
    startHttpTransport(httpServer, serverBackendFactory);
  } else {
    await startStdioTransport(serverBackendFactory);
  }
}
async function startStdioTransport(serverBackendFactory: ServerBackendFactory) {
  await connect(serverBackendFactory, new StdioServerTransport(), false);
}
const testDebug = debug('pw:mcp:test');
async function handleSSE(
  serverBackendFactory: ServerBackendFactory,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  sessions: Map<string, SSEServerTransport>
) {
  if (req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      res.statusCode = 400;
      return res.end('Missing sessionId');
    }
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      return res.end('Session not found');
    }
    return await transport.handlePostMessage(req, res);
  }
  if (req.method === 'GET') {
    const transport = new SSEServerTransport('/sse', res);
    sessions.set(transport.sessionId, transport);
    testDebug(`create SSE session: ${transport.sessionId}`);
    await connect(serverBackendFactory, transport, false);
    res.on('close', () => {
      testDebug(`delete SSE session: ${transport.sessionId}`);
      sessions.delete(transport.sessionId);
    });
    return;
  }
  res.statusCode = 405;
  res.end('Method not allowed');
}
async function handleStreamable(
  serverBackendFactory: ServerBackendFactory,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, StreamableHTTPServerTransport>
) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      res.end('Session not found');
      return;
    }
    return await transport.handleRequest(req, res);
  }
  if (req.method === 'POST') {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: async (_httpSessionId) => {
        testDebug(`create http session: ${transport.sessionId}`);
        await connect(serverBackendFactory, transport, true);
        if (transport.sessionId) {
          sessions.set(transport.sessionId, transport);
        }
      },
    });
    transport.onclose = () => {
      if (!transport.sessionId) {
        return;
      }
      sessions.delete(transport.sessionId);
      testDebug(`delete http session: ${transport.sessionId}`);
    };
    await transport.handleRequest(req, res);
    return;
  }
  res.statusCode = 400;
  res.end('Invalid request');
}
function startHttpTransport(
  httpServer: http.Server,
  serverBackendFactory: ServerBackendFactory
) {
  const sseSessions = new Map();
  const streamableSessions = new Map();
  httpServer.on('request', async (req, res) => {
    const url = new URL(`http://localhost${req.url}`);
    if (url.pathname.startsWith('/sse')) {
      await handleSSE(serverBackendFactory, req, res, url, sseSessions);
    } else {
      await handleStreamable(
        serverBackendFactory,
        req,
        res,
        streamableSessions
      );
    }
  });
  const url = httpAddressToString(httpServer.address());
  const message = [
    `Listening on ${url}`,
    'Put this in your client config:',
    JSON.stringify(
      {
        mcpServers: {
          playwright: {
            url: `${url}/mcp`,
          },
        },
      },
      undefined,
      2
    ),
    'For legacy SSE transport support, you can use the /sse endpoint instead.',
  ].join('\n');
  console.log(message);
}
