// Bearer-token gate in front of Playwright MCP.
//
// Playwright MCP ships no authentication in HTTP mode, and it exposes an
// RCE-equivalent tool (browser_run_code_unsafe) that no flag can remove. On
// Render the server gets a public URL, so "anyone who reaches it" is the whole
// internet. This process is the door: it listens on $PORT, requires
// `Authorization: Bearer $MCP_TOKEN`, and forwards only authenticated requests
// to the real server on 127.0.0.1:$UPSTREAM_PORT (which is not published).
//
// It also acts as PID 1: it spawns the upstream server given as its argv, dies
// when the child dies, and forwards SIGTERM/SIGINT so Render's shutdown works.
//
// Usage: node render-auth-proxy.mjs node /app/cli.js --port 8931 ...

import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT || 8931);
const TOKEN = process.env.MCP_TOKEN;

// Fail closed: no token, no server. There is deliberately no flag to disable
// the check — an unauthenticated deploy is never a safe default here.
if (!TOKEN) {
  console.error('[auth] MCP_TOKEN is not set. Refusing to start an unauthenticated server.');
  process.exit(1);
}

// Hash both sides so timingSafeEqual gets equal-length buffers regardless of
// the presented token's length (it throws otherwise, which would itself leak).
const digest = value => createHash('sha256').update(value).digest();
const EXPECTED = digest(TOKEN);

const isAuthorized = header => {
  const presented = /^Bearer (.+)$/.exec(header || '')?.[1];
  return presented !== undefined && timingSafeEqual(digest(presented), EXPECTED);
};

const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 1));
child.on('error', err => {
  console.error(`[auth] failed to start upstream: ${err.message}`);
  process.exit(1);
});

const server = http.createServer((req, res) => {
  if (!isAuthorized(req.headers.authorization)) {
    // No detail in the body, and never log the presented token.
    console.error(`[auth] 401 ${req.method} ${req.url}`);
    res.writeHead(401, { 'WWW-Authenticate': 'Bearer', 'Content-Type': 'text/plain' });
    res.end('Unauthorized\n');
    return;
  }

  // Host is forwarded unchanged so upstream's --allowed-hosts DNS-rebinding
  // check still sees the hostname the client actually asked for.
  const upstream = http.request(
    { host: '127.0.0.1', port: UPSTREAM_PORT, method: req.method, path: req.url, headers: req.headers },
    upstreamRes => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', err => {
    console.error(`[auth] upstream error: ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway\n');
  });
  req.pipe(upstream);
  req.on('aborted', () => upstream.destroy());
});

// MCP's Streamable HTTP keeps SSE responses open indefinitely; the default
// request timeout would cut them off mid-stream.
server.requestTimeout = 0;
server.timeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 0;

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    child.kill(signal);
    server.close();
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[auth] Bearer-token gate listening on 0.0.0.0:${PORT} → 127.0.0.1:${UPSTREAM_PORT}`);
});
