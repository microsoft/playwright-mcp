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

package connection

import (
	"github.com/gorilla/websocket"
	"github.com/pkg/errors"
)

// WebSocketTransport implements the Transport interface using WebSockets
type WebSocketTransport struct {
	conn *websocket.Conn
}

// NewWebSocketTransport creates a new WebSocket transport
func NewWebSocketTransport(conn *websocket.Conn) *WebSocketTransport {
	return &WebSocketTransport{
		conn: conn,
	}
}

// Send sends a message through the WebSocket
func (t *WebSocketTransport) Send(message []byte) error {
	if t.conn == nil {
		return errors.New("websocket connection is nil")
	}
	return t.conn.WriteMessage(websocket.TextMessage, message)
}

// Receive receives a message from the WebSocket
func (t *WebSocketTransport) Receive() ([]byte, error) {
	if t.conn == nil {
		return nil, errors.New("websocket connection is nil")
	}

	_, message, err := t.conn.ReadMessage()
	if err != nil {
		return nil, err
	}
	return message, nil
}

// Close closes the WebSocket connection
func (t *WebSocketTransport) Close() error {
	if t.conn == nil {
		return nil
	}
	return t.conn.Close()
}
