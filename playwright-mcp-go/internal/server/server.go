package server

import (
	"sync"
)

type Config struct {
	// Add config fields as needed
}

type Tool interface {
	Name() string
	Description() string
	Call(args map[string]interface{}) (interface{}, error)
}

type Connection struct {
	Tools []Tool
	// Add more fields as needed (e.g., session state)
}

type Server struct {
	config      Config
	connections []*Connection
	tools       []Tool
	mu          sync.Mutex
}

func NewServer(config Config) *Server {
	return &Server{
		config:      config,
		connections: []*Connection{},
		tools:       []Tool{},
	}
}

func (s *Server) RegisterTool(tool Tool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tools = append(s.tools, tool)
}

func (s *Server) ListTools() []Tool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Tool{}, s.tools...)
}

func (s *Server) CreateConnection() *Connection {
	s.mu.Lock()
	defer s.mu.Unlock()
	conn := &Connection{Tools: s.tools}
	s.connections = append(s.connections, conn)
	return conn
} 