package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/microsoft/playwright-mcp-go/internal/config"
	"github.com/microsoft/playwright-mcp-go/internal/server"
)

func main() {
	// Parse command-line flags
	var cliOptions config.CLIOptions

	// Browser options
	flag.StringVar(&cliOptions.Browser, "browser", "", "Browser to use (chrome, firefox, webkit)")
	flag.StringVar(&cliOptions.BrowserAgent, "browser-agent", "", "Browser agent to use")
	flag.StringVar(&cliOptions.CDPEndpoint, "cdp-endpoint", "", "CDP endpoint to connect to")
	flag.StringVar(&cliOptions.ExecutablePath, "executable-path", "", "Path to browser executable")
	flag.BoolVar(&cliOptions.Headless, "headless", false, "Run browser in headless mode")
	flag.BoolVar(&cliOptions.Isolated, "isolated", false, "Run browser in isolated mode")
	flag.StringVar(&cliOptions.UserDataDir, "user-data-dir", "", "Path to user data directory")
	flag.StringVar(&cliOptions.Device, "device", "", "Device to emulate")
	flag.StringVar(&cliOptions.ViewportSize, "viewport-size", "", "Viewport size (width,height)")
	flag.StringVar(&cliOptions.UserAgent, "user-agent", "", "User agent to use")
	flag.BoolVar(&cliOptions.Sandbox, "sandbox", true, "Enable sandbox")
	flag.StringVar(&cliOptions.StorageState, "storage-state", "", "Path to storage state")

	// Network options
	flag.Func("allowed-origins", "Allowed origins (comma-separated)", func(s string) error {
		cliOptions.AllowedOrigins = strings.Split(s, ",")
		return nil
	})
	flag.Func("blocked-origins", "Blocked origins (comma-separated)", func(s string) error {
		cliOptions.BlockedOrigins = strings.Split(s, ",")
		return nil
	})
	flag.BoolVar(&cliOptions.BlockServiceWorkers, "block-service-workers", false, "Block service workers")
	flag.BoolVar(&cliOptions.IgnoreHTTPSErrors, "ignore-https-errors", false, "Ignore HTTPS errors")
	flag.StringVar(&cliOptions.ProxyServer, "proxy-server", "", "Proxy server to use")
	flag.StringVar(&cliOptions.ProxyBypass, "proxy-bypass", "", "Proxy bypass list")

	// Server options
	flag.IntVar(&cliOptions.Port, "port", 9224, "Port to listen on")
	flag.StringVar(&cliOptions.Host, "host", "localhost", "Host to listen on")

	// Other options
	flag.StringVar(&cliOptions.Config, "config", "", "Path to config file")
	flag.StringVar(&cliOptions.Caps, "caps", "", "Capabilities (comma-separated)")
	flag.BoolVar(&cliOptions.Vision, "vision", false, "Enable vision capabilities")
	flag.BoolVar(&cliOptions.Extension, "extension", false, "Enable extension mode")
	flag.BoolVar(&cliOptions.SaveTrace, "save-trace", false, "Save trace")
	flag.StringVar(&cliOptions.OutputDir, "output-dir", "", "Output directory")
	var imageResponses string
	flag.StringVar(&imageResponses, "image-responses", "auto", "Image responses mode (allow, omit, auto)")
	cliOptions.ImageResponses = config.ImageResponseMode(imageResponses)

	// Parse flags
	flag.Parse()

	// Resolve config
	cfg, err := config.ResolveCLIConfig(&cliOptions)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error resolving config: %v\n", err)
		os.Exit(1)
	}

	// Create server
	srv, err := server.NewServer(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating server: %v\n", err)
		os.Exit(1)
	}

	// Start server
	if err := srv.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Error starting server: %v\n", err)
		os.Exit(1)
	}
}
