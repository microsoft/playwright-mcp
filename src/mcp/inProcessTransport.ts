import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  JSONRPCMessage,
  MessageExtraInfo,
} from '@modelcontextprotocol/sdk/types.js';
export class InProcessTransport implements Transport {
  private readonly _server: Server;
  private readonly _serverTransport: InProcessServerTransport;
  private _connected = false;
  constructor(server: Server) {
    this._server = server;
    this._serverTransport = new InProcessServerTransport(this);
  }
  async start(): Promise<void> {
    if (this._connected) {
      throw new Error('InprocessTransport already started!');
    }
    await this._server.connect(this._serverTransport);
    this._connected = true;
  }
  send(
    message: JSONRPCMessage,
    _options?: TransportSendOptions
  ): Promise<void> {
    if (!this._connected) {
      throw new Error('Transport not connected');
    }
    this._serverTransport._receiveFromClient(message);
    return Promise.resolve();
  }
  close(): Promise<void> {
    if (this._connected) {
      this._connected = false;
      this.onclose?.();
      this._serverTransport.onclose?.();
    }
    return Promise.resolve();
  }
  onclose: (() => void) | undefined;
  onerror: ((error: Error) => void) | undefined;
  onmessage:
    | ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void)
    | undefined;
  sessionId: string | undefined;
  setProtocolVersion: ((version: string) => void) | undefined;
  _receiveFromServer(message: JSONRPCMessage, extra?: MessageExtraInfo): void {
    this.onmessage?.(message, extra);
  }
}
class InProcessServerTransport implements Transport {
  private readonly _clientTransport: InProcessTransport;
  constructor(clientTransport: InProcessTransport) {
    this._clientTransport = clientTransport;
  }
  start(): Promise<void> {
    // No-op implementation: InProcessServerTransport requires no initialization.
    // Unlike network-based transports, this in-process transport is immediately
    // ready for communication once instantiated.
    if (!this._clientTransport) {
      throw new Error(
        'InProcessServerTransport: Client transport not available'
      );
    }
    return Promise.resolve();
  }
  send(
    message: JSONRPCMessage,
    _options?: TransportSendOptions
  ): Promise<void> {
    // Send message directly to client transport for in-process communication.
    this._clientTransport._receiveFromServer(message);
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }
  onclose: (() => void) | undefined;
  onerror: ((error: Error) => void) | undefined;
  onmessage:
    | ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void)
    | undefined;
  sessionId: string | undefined;
  setProtocolVersion: ((version: string) => void) | undefined;
  _receiveFromClient(message: JSONRPCMessage, extra?: MessageExtraInfo): void {
    this.onmessage?.(message, extra);
  }
}
