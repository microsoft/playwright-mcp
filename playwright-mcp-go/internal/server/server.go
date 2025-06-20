package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/microsoft/playwright-mcp-go/internal/browser"
	"github.com/microsoft/playwright-mcp-go/internal/config"
	"github.com/microsoft/playwright-mcp-go/internal/connection"
)

// Server represents the MCP server
type Server struct {
	Config         *config.FullConfig
	ConnectionList []*connection.Connection
	BrowserConfig  config.BrowserConfig
	ContextFactory browser.BrowserContextFactory
	BrowserManager *browser.BrowserManager
	HTTPServer     *http.Server
}

// NewServer creates a new server
func NewServer(cfg *config.FullConfig) (*Server, error) {
	browserConfig := cfg.Browser
	contextFactory, err := browser.ContextFactory(browserConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create context factory: %w", err)
	}

	return &Server{
		Config:         cfg,
		ConnectionList: make([]*connection.Connection, 0),
		BrowserConfig:  browserConfig,
		ContextFactory: contextFactory,
		BrowserManager: browser.NewBrowserManager(),
	}, nil
}

// Start starts the server
func (s *Server) Start() error {
	// Set up HTTP server
	mux := http.NewServeMux()

	// Set up routes
	mux.HandleFunc("/json/list", s.handleJSONList)
	mux.HandleFunc("/json/launch", s.handleLaunchBrowser)

	// Create HTTP server
	s.HTTPServer = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", s.Config.Server.Host, s.Config.Server.Port),
		Handler: mux,
	}

	// Set up exit watchdog
	s.setupExitWatchdog()

	// Start HTTP server
	fmt.Printf("Playwright Browser Server v%s\n", "0.1.0") // TODO: Get version from package
	fmt.Printf("Listening on http://%s:%d\n", s.Config.Server.Host, s.Config.Server.Port)

	return s.HTTPServer.ListenAndServe()
}

// CreateConnection creates a new connection
func (s *Server) CreateConnection(transport connection.Transport) (*connection.Connection, error) {
	conn, err := connection.NewConnection(s.Config, s.ContextFactory)
	if err != nil {
		return nil, err
	}

	s.ConnectionList = append(s.ConnectionList, conn)

	if err := conn.Connect(transport); err != nil {
		return nil, err
	}

	return conn, nil
}

// Close closes the server
func (s *Server) Close() error {
	// Close all connections
	for _, conn := range s.ConnectionList {
		if err := conn.Close(); err != nil {
			fmt.Printf("Error closing connection: %v\n", err)
		}
	}

	// Close HTTP server
	if s.HTTPServer != nil {
		if err := s.HTTPServer.Close(); err != nil {
			return fmt.Errorf("error closing HTTP server: %w", err)
		}
	}

	// Close all browsers
	if err := s.BrowserManager.CloseAllBrowsers(); err != nil {
		return fmt.Errorf("error closing browsers: %w", err)
	}

	return nil
}

// SetupExitWatchdog sets up the exit watchdog
func (s *Server) setupExitWatchdog() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		fmt.Println("Shutting down...")
		if err := s.Close(); err != nil {
			fmt.Printf("Error during shutdown: %v\n", err)
		}
		os.Exit(0)
	}()
}

// HTTP handlers

func (s *Server) handleJSONList(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement this
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("[]"))
}

func (s *Server) handleLaunchBrowser(w http.ResponseWriter, r *http.Request) {
	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error reading request body: %v", err), http.StatusBadRequest)
		return
	}

	// Parse request
	var request browser.LaunchBrowserRequest
	if err := json.Unmarshal(body, &request); err != nil {
		http.Error(w, fmt.Sprintf("Error parsing request: %v", err), http.StatusBadRequest)
		return
	}

	// Launch browser
	info, err := s.BrowserManager.LaunchBrowser(&request)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error launching browser: %v", err), http.StatusInternalServerError)
		return
	}

	// Return response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(info)
}
