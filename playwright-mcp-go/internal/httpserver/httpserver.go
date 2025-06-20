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

package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/microsoft/playwright-mcp-go/internal/connection"
	"github.com/microsoft/playwright-mcp-go/internal/server"
	"github.com/rs/zerolog/log"
)

// Server is an HTTP server that handles WebSocket connections
type Server struct {
	httpServer *http.Server
	upgrader   websocket.Upgrader
	mcpServer  *server.Server
	mu         sync.Mutex
}

// NewServer creates a new HTTP server
func NewServer(mcpServer *server.Server) *Server {
	return &Server{
		mcpServer: mcpServer,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

// Start starts the HTTP server on the given address
func (s *Server) Start(addr string) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleWebSocket)

	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	log.Info().Msgf("HTTP server listening on %s", addr)
	return s.httpServer.ListenAndServe()
}

// handleWebSocket handles WebSocket connections
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upgrade connection")
		return
	}

	log.Info().Msg("New websocket connection")

	// Create a transport for the connection
	transport := connection.NewWebSocketTransport(conn)

	// Create a new MCP connection
	_, err = s.mcpServer.CreateConnection(transport)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create MCP connection")
		conn.Close()
		return
	}

	// The connection is now managed by the MCP server
}

// Stop stops the HTTP server
func (s *Server) Stop() error {
	if s.httpServer == nil {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	return s.httpServer.Shutdown(context.Background())
}

// RunServer runs the HTTP server and blocks until it's stopped
func RunServer(mcpServer *server.Server, port int) error {
	httpServer := NewServer(mcpServer)
	addr := fmt.Sprintf(":%d", port)
	return httpServer.Start(addr)
}
