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
	"encoding/json"
	"sync"

	"github.com/microsoft/playwright-mcp-go/internal/browser"
	"github.com/microsoft/playwright-mcp-go/internal/config"
	"github.com/pkg/errors"
)

// Transport interface for the MCP protocol
type Transport interface {
	Send(message []byte) error
	Receive() ([]byte, error)
	Close() error
}

// MCPServer represents the MCP protocol server
type MCPServer struct {
	transport Transport
	handlers  map[string]func(payload json.RawMessage) (interface{}, error)
	mu        sync.Mutex
}

// Connection represents a connection to an MCP client
type Connection struct {
	Server         *MCPServer
	Config         *config.FullConfig
	ContextFactory browser.ContextFactory
}

// NewConnection creates a new MCP connection
func NewConnection(config *config.FullConfig, factory browser.ContextFactory) (*Connection, error) {
	server := &MCPServer{
		handlers: make(map[string]func(payload json.RawMessage) (interface{}, error)),
	}

	connection := &Connection{
		Server:         server,
		Config:         config,
		ContextFactory: factory,
	}

	// Register handlers for MCP methods here
	// server.registerHandler("method.name", connection.handleMethodName)

	return connection, nil
}

// Connect sets up the transport for the MCP server
func (s *MCPServer) Connect(transport Transport) error {
	s.mu.Lock()
	s.transport = transport
	s.mu.Unlock()

	// Start listening for messages
	go s.handleMessages()

	return nil
}

// handleMessages processes incoming messages from the transport
func (s *MCPServer) handleMessages() {
	for {
		message, err := s.transport.Receive()
		if err != nil {
			// Handle disconnection
			break
		}

		// Parse the message
		var request struct {
			ID      string          `json:"id"`
			Method  string          `json:"method"`
			Params  json.RawMessage `json:"params"`
			JsonRPC string          `json:"jsonrpc"`
		}

		if err := json.Unmarshal(message, &request); err != nil {
			// Send error response for invalid JSON
			s.sendErrorResponse(request.ID, -32700, "Parse error", nil)
			continue
		}

		// Find handler for method
		s.mu.Lock()
		handler, ok := s.handlers[request.Method]
		s.mu.Unlock()

		if !ok {
			// Method not found
			s.sendErrorResponse(request.ID, -32601, "Method not found", nil)
			continue
		}

		// Execute handler
		go func(id string, params json.RawMessage, method string) {
			result, err := handler(params)
			if err != nil {
				s.sendErrorResponse(id, -32000, err.Error(), nil)
				return
			}
			s.sendSuccessResponse(id, result)
		}(request.ID, request.Params, request.Method)
	}
}

// registerHandler registers a function to handle a specific MCP method
func (s *MCPServer) registerHandler(method string, handler func(payload json.RawMessage) (interface{}, error)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers[method] = handler
}

// sendSuccessResponse sends a JSON-RPC success response
func (s *MCPServer) sendSuccessResponse(id string, result interface{}) error {
	response := struct {
		ID      string      `json:"id"`
		Result  interface{} `json:"result"`
		JsonRPC string      `json:"jsonrpc"`
	}{
		ID:      id,
		Result:  result,
		JsonRPC: "2.0",
	}

	data, err := json.Marshal(response)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.transport != nil {
		return s.transport.Send(data)
	}
	return errors.New("transport not connected")
}

// sendErrorResponse sends a JSON-RPC error response
func (s *MCPServer) sendErrorResponse(id string, code int, message string, data interface{}) error {
	response := struct {
		ID    string `json:"id"`
		Error struct {
			Code    int         `json:"code"`
			Message string      `json:"message"`
			Data    interface{} `json:"data,omitempty"`
		} `json:"error"`
		JsonRPC string `json:"jsonrpc"`
	}{
		ID: id,
		Error: struct {
			Code    int         `json:"code"`
			Message string      `json:"message"`
			Data    interface{} `json:"data,omitempty"`
		}{
			Code:    code,
			Message: message,
			Data:    data,
		},
		JsonRPC: "2.0",
	}

	data, err := json.Marshal(response)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.transport != nil {
		return s.transport.Send(data.([]byte))
	}
	return errors.New("transport not connected")
}

// Close closes the connection
func (c *Connection) Close() error {
	// Close any active browser contexts
	// Close the transport
	if c.Server.transport != nil {
		return c.Server.transport.Close()
	}
	return nil
}
