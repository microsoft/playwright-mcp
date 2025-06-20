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

package server

import (
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/microsoft/playwright-mcp-go/internal/browser"
	"github.com/microsoft/playwright-mcp-go/internal/config"
	"github.com/microsoft/playwright-mcp-go/internal/connection"
	"github.com/pkg/errors"
)

// Server represents the MCP server
type Server struct {
	Config          *config.FullConfig
	ConnectionList  []*connection.Connection
	ContextFactory  browser.ContextFactory
	connectionMutex sync.Mutex
}

// New creates a new MCP server
func New(config *config.FullConfig) (*Server, error) {
	// Create the browser context factory
	factory, err := browser.NewContextFactory(config.Browser)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create browser context factory")
	}

	return &Server{
		Config:         config,
		ConnectionList: make([]*connection.Connection, 0),
		ContextFactory: factory,
	}, nil
}

// CreateConnection creates a new connection with transport
func (s *Server) CreateConnection(transport connection.Transport) (*connection.Connection, error) {
	conn, err := connection.NewConnection(s.Config, s.ContextFactory)
	if err != nil {
		return nil, err
	}

	s.connectionMutex.Lock()
	s.ConnectionList = append(s.ConnectionList, conn)
	s.connectionMutex.Unlock()

	if err := conn.Server.Connect(transport); err != nil {
		return nil, err
	}

	return conn, nil
}

// SetupExitWatchdog sets up signal handlers to gracefully shutdown the server
func (s *Server) SetupExitWatchdog() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)

	isExiting := false

	go func() {
		<-sigChan
		if isExiting {
			return
		}
		isExiting = true

		// Force exit after 15 seconds
		go func() {
			time.Sleep(15 * time.Second)
			os.Exit(0)
		}()

		// Try to close all connections gracefully
		s.connectionMutex.Lock()
		connections := s.ConnectionList
		s.connectionMutex.Unlock()

		for _, conn := range connections {
			_ = conn.Close()
		}

		os.Exit(0)
	}()
}

// Close closes the server and all connections
func (s *Server) Close() error {
	s.connectionMutex.Lock()
	connections := s.ConnectionList
	s.ConnectionList = make([]*connection.Connection, 0)
	s.connectionMutex.Unlock()

	// Close all connections
	for _, conn := range connections {
		if err := conn.Close(); err != nil {
			return err
		}
	}

	return nil
}
