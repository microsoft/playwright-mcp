import assert from 'node:assert/strict';
import http from 'node:http';
import type * as net from 'node:net';
export async function startHttpServer(config: {
  host?: string;
  port?: number;
}): Promise<http.Server> {
  const { host, port } = config;
  const httpServer = http.createServer();
  await new Promise<void>((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(port, host, () => {
      resolve();
      httpServer.removeListener('error', reject);
    });
  });
  return httpServer;
}
export function httpAddressToString(
  address: string | net.AddressInfo | null
): string {
  assert(address, 'Could not bind server socket');
  if (typeof address === 'string') {
    return address;
  }
  const resolvedPort = address.port;
  let resolvedHost =
    address.family === 'IPv4' ? address.address : `[${address.address}]`;
  if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]') {
    resolvedHost = 'localhost';
  }
  return `http://${resolvedHost}:${resolvedPort}`;
}
