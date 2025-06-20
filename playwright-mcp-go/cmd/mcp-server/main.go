package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/yourusername/playwright-mcp-go/internal/server"
)

func main() {
	browserManager := server.NewBrowserManager()

	coreServer := server.NewServer(server.Config{})
	coreServer.RegisterTool(&server.EchoTool{})

	mux := http.NewServeMux()

	// HTTP endpoint stubs
	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "MCP endpoint stub")
	})
	mux.HandleFunc("/sse", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "SSE endpoint stub")
	})
	mux.HandleFunc("/json/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(browserManager.List())
	})
	mux.HandleFunc("/json/launch", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			fmt.Fprintln(w, "Method not allowed")
			return
		}
		var req server.LaunchBrowserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintln(w, "Invalid request body")
			return
		}
		info := browserManager.Launch(req)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	})
	mux.HandleFunc("/tools", func(w http.ResponseWriter, r *http.Request) {
		tools := coreServer.ListTools()
		out := make([]map[string]string, len(tools))
		for i, t := range tools {
			out[i] = map[string]string{"name": t.Name(), "description": t.Description()}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})

	// WebSocket upgrade stubs (to be implemented)
	mux.HandleFunc("/cdp", func(w http.ResponseWriter, r *http.Request) {
		// TODO: Implement WebSocket upgrade and relay logic
		w.WriteHeader(http.StatusNotImplemented)
		fmt.Fprintln(w, "CDP WebSocket endpoint stub")
	})
	mux.HandleFunc("/extension", func(w http.ResponseWriter, r *http.Request) {
		// TODO: Implement WebSocket upgrade and relay logic
		w.WriteHeader(http.StatusNotImplemented)
		fmt.Fprintln(w, "Extension WebSocket endpoint stub")
	})

	addr := ":9224" // Default port
	log.Printf("Playwright MCP Go server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
