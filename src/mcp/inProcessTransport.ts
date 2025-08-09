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
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;
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
    // No-op for in-process transport - in-process server transport doesn't require initialization
    return Promise.resolve();
  }
  send(
    message: JSONRPCMessage,
    _options?: TransportSendOptions
  ): Promise<void> {
    this._clientTransport._receiveFromServer(message);
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;
  _receiveFromClient(message: JSONRPCMessage): void {
    this.onmessage?.(message);
  }
}
