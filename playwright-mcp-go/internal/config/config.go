package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// ToolCapability represents a capability that a tool can have
type ToolCapability string

const (
	// Core capabilities
	CapabilityCore     ToolCapability = "core"
	CapabilityHistory  ToolCapability = "history"
	CapabilityNetwork  ToolCapability = "network"
	CapabilityConsole  ToolCapability = "console"
	CapabilityKeyboard ToolCapability = "keyboard"
	CapabilityFiles    ToolCapability = "files"
	CapabilityDialogs  ToolCapability = "dialogs"
	CapabilityTabs     ToolCapability = "tabs"
	CapabilityVision   ToolCapability = "vision"
)

// ImageResponseMode determines how image responses are handled
type ImageResponseMode string

const (
	ImageResponseModeAllow ImageResponseMode = "allow"
	ImageResponseModeOmit  ImageResponseMode = "omit"
	ImageResponseModeAuto  ImageResponseMode = "auto"
)

// BrowserConfig contains configuration for the browser
type BrowserConfig struct {
	BrowserName    string                 `json:"browserName"`
	BrowserAgent   string                 `json:"browserAgent"`
	Isolated       bool                   `json:"isolated"`
	UserDataDir    string                 `json:"userDataDir"`
	LaunchOptions  map[string]interface{} `json:"launchOptions"`
	ContextOptions map[string]interface{} `json:"contextOptions"`
	CDPEndpoint    string                 `json:"cdpEndpoint"`
}

// NetworkConfig contains network-related configuration
type NetworkConfig struct {
	AllowedOrigins []string `json:"allowedOrigins"`
	BlockedOrigins []string `json:"blockedOrigins"`
}

// ServerConfig contains server-related configuration
type ServerConfig struct {
	Port int    `json:"port"`
	Host string `json:"host"`
}

// Config represents the user-provided configuration
type Config struct {
	Browser        *BrowserConfig    `json:"browser"`
	Network        *NetworkConfig    `json:"network"`
	Server         *ServerConfig     `json:"server"`
	Capabilities   []ToolCapability  `json:"capabilities"`
	Vision         bool              `json:"vision"`
	Extension      bool              `json:"extension"`
	SaveTrace      bool              `json:"saveTrace"`
	OutputDir      string            `json:"outputDir"`
	ImageResponses ImageResponseMode `json:"imageResponses"`
}

// FullConfig represents the resolved configuration with all defaults applied
type FullConfig struct {
	Browser        BrowserConfig     `json:"browser"`
	Network        NetworkConfig     `json:"network"`
	Server         ServerConfig      `json:"server"`
	Capabilities   []ToolCapability  `json:"capabilities"`
	Vision         bool              `json:"vision"`
	Extension      bool              `json:"extension"`
	SaveTrace      bool              `json:"saveTrace"`
	OutputDir      string            `json:"outputDir"`
	ImageResponses ImageResponseMode `json:"imageResponses"`
}

// CLIOptions represents command-line options
type CLIOptions struct {
	AllowedOrigins      []string
	BlockedOrigins      []string
	BlockServiceWorkers bool
	Browser             string
	BrowserAgent        string
	Caps                string
	CDPEndpoint         string
	Config              string
	Device              string
	ExecutablePath      string
	Headless            bool
	Host                string
	IgnoreHTTPSErrors   bool
	Isolated            bool
	ImageResponses      ImageResponseMode
	Sandbox             bool
	OutputDir           string
	Port                int
	ProxyBypass         string
	ProxyServer         string
	SaveTrace           bool
	StorageState        string
	UserAgent           string
	UserDataDir         string
	ViewportSize        string
	Vision              bool
	Extension           bool
}

// DefaultConfig returns the default configuration
func DefaultConfig() FullConfig {
	// Determine if headless mode should be the default
	headless := runtime.GOOS == "linux" && os.Getenv("DISPLAY") == ""

	return FullConfig{
		Browser: BrowserConfig{
			BrowserName: "chromium",
			LaunchOptions: map[string]interface{}{
				"channel":         "chrome",
				"headless":        headless,
				"chromiumSandbox": true,
			},
			ContextOptions: map[string]interface{}{
				"viewport": nil,
			},
		},
		Network:   NetworkConfig{},
		Server:    ServerConfig{},
		OutputDir: filepath.Join(os.TempDir(), "playwright-mcp-output", sanitizeForFilePath(fmt.Sprintf("%v", time.Now()))),
	}
}

// ResolveConfig resolves the user configuration with defaults
func ResolveConfig(userConfig *Config) (*FullConfig, error) {
	defaultConfig := DefaultConfig()

	// If userConfig is nil, return the default config
	if userConfig == nil {
		return &defaultConfig, nil
	}

	// Merge the user config with the default config
	return mergeConfig(&defaultConfig, userConfig)
}

// ResolveCLIConfig resolves configuration from CLI options
func ResolveCLIConfig(cliOptions *CLIOptions) (*FullConfig, error) {
	// Load config from file if specified
	var configFromFile *Config
	var err error
	if cliOptions.Config != "" {
		configFromFile, err = loadConfig(cliOptions.Config)
		if err != nil {
			return nil, err
		}
	}

	// Convert CLI options to Config
	cliConfig, err := configFromCLIOptions(cliOptions)
	if err != nil {
		return nil, err
	}

	// Merge configs: default <- file <- CLI
	defaultConfig := DefaultConfig()
	var result *FullConfig

	if configFromFile != nil {
		intermediate, err := mergeConfig(&defaultConfig, configFromFile)
		if err != nil {
			return nil, err
		}
		result, err = mergeConfig(intermediate, cliConfig)
		if err != nil {
			return nil, err
		}
	} else {
		result, err = mergeConfig(&defaultConfig, cliConfig)
		if err != nil {
			return nil, err
		}
	}

	// Derive artifact output directory from config.OutputDir
	if result.SaveTrace {
		if result.Browser.LaunchOptions == nil {
			result.Browser.LaunchOptions = make(map[string]interface{})
		}
		result.Browser.LaunchOptions["tracesDir"] = filepath.Join(result.OutputDir, "traces")
	}

	return result, nil
}

// ValidateConfig validates the configuration
func ValidateConfig(config *Config) error {
	if config.Extension {
		if config.Browser == nil || config.Browser.BrowserName != "chromium" {
			return errors.New("extension mode is only supported for Chromium browsers")
		}
	}
	return nil
}

// Utility functions
func sanitizeForFilePath(s string) string {
	// Replace characters that are not allowed in file paths
	// This is a simplified implementation
	s = strings.ReplaceAll(s, ":", "-")
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	return s
}

func loadConfig(configFile string) (*Config, error) {
	data, err := os.ReadFile(configFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %s, %w", configFile, err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %s, %w", configFile, err)
	}

	return &config, nil
}

func configFromCLIOptions(cliOptions *CLIOptions) (*Config, error) {
	// Implementation of converting CLI options to Config
	// This is a placeholder implementation
	config := &Config{}

	// Set browser name based on CLI options
	var browserName string
	var channel string

	switch cliOptions.Browser {
	case "chrome", "chrome-beta", "chrome-canary", "chrome-dev", "chromium", "msedge", "msedge-beta", "msedge-canary", "msedge-dev":
		browserName = "chromium"
		channel = cliOptions.Browser
	case "firefox":
		browserName = "firefox"
	case "webkit":
		browserName = "webkit"
	}

	// Set browser config
	config.Browser = &BrowserConfig{
		BrowserName:  browserName,
		BrowserAgent: cliOptions.BrowserAgent,
		Isolated:     cliOptions.Isolated,
		UserDataDir:  cliOptions.UserDataDir,
		CDPEndpoint:  cliOptions.CDPEndpoint,
	}

	// Set launch options
	launchOptions := make(map[string]interface{})
	if channel != "" {
		launchOptions["channel"] = channel
	}
	if cliOptions.ExecutablePath != "" {
		launchOptions["executablePath"] = cliOptions.ExecutablePath
	}
	launchOptions["headless"] = cliOptions.Headless

	if !cliOptions.Sandbox {
		launchOptions["chromiumSandbox"] = false
	}

	if cliOptions.ProxyServer != "" {
		proxy := make(map[string]interface{})
		proxy["server"] = cliOptions.ProxyServer
		if cliOptions.ProxyBypass != "" {
			proxy["bypass"] = cliOptions.ProxyBypass
		}
		launchOptions["proxy"] = proxy
	}

	config.Browser.LaunchOptions = launchOptions

	// Set context options
	contextOptions := make(map[string]interface{})

	if cliOptions.StorageState != "" {
		contextOptions["storageState"] = cliOptions.StorageState
	}

	if cliOptions.UserAgent != "" {
		contextOptions["userAgent"] = cliOptions.UserAgent
	}

	if cliOptions.ViewportSize != "" {
		parts := strings.Split(cliOptions.ViewportSize, ",")
		if len(parts) != 2 {
			return nil, errors.New("invalid viewport size format: use \"width,height\", for example --viewport-size=\"800,600\"")
		}

		width, err := strconv.Atoi(parts[0])
		if err != nil {
			return nil, errors.New("invalid viewport width")
		}

		height, err := strconv.Atoi(parts[1])
		if err != nil {
			return nil, errors.New("invalid viewport height")
		}

		viewport := make(map[string]interface{})
		viewport["width"] = width
		viewport["height"] = height
		contextOptions["viewport"] = viewport
	}

	if cliOptions.IgnoreHTTPSErrors {
		contextOptions["ignoreHTTPSErrors"] = true
	}

	if cliOptions.BlockServiceWorkers {
		contextOptions["serviceWorkers"] = "block"
	}

	config.Browser.ContextOptions = contextOptions

	// Set server config
	config.Server = &ServerConfig{
		Port: cliOptions.Port,
		Host: cliOptions.Host,
	}

	// Set other config options
	if cliOptions.Caps != "" {
		capabilities := strings.Split(cliOptions.Caps, ",")
		for i, cap := range capabilities {
			capabilities[i] = strings.TrimSpace(cap)
		}

		config.Capabilities = make([]ToolCapability, len(capabilities))
		for i, cap := range capabilities {
			config.Capabilities[i] = ToolCapability(cap)
		}
	}

	config.Vision = cliOptions.Vision
	config.Extension = cliOptions.Extension
	config.Network = &NetworkConfig{
		AllowedOrigins: cliOptions.AllowedOrigins,
		BlockedOrigins: cliOptions.BlockedOrigins,
	}
	config.SaveTrace = cliOptions.SaveTrace
	config.OutputDir = cliOptions.OutputDir
	config.ImageResponses = cliOptions.ImageResponses

	return config, nil
}

func mergeConfig(base *FullConfig, overrides *Config) (*FullConfig, error) {
	result := *base

	// Merge browser config
	if overrides.Browser != nil {
		if overrides.Browser.BrowserName != "" {
			result.Browser.BrowserName = overrides.Browser.BrowserName
		}

		if overrides.Browser.BrowserAgent != "" {
			result.Browser.BrowserAgent = overrides.Browser.BrowserAgent
		}

		result.Browser.Isolated = overrides.Browser.Isolated || base.Browser.Isolated

		if overrides.Browser.UserDataDir != "" {
			result.Browser.UserDataDir = overrides.Browser.UserDataDir
		}

		if overrides.Browser.CDPEndpoint != "" {
			result.Browser.CDPEndpoint = overrides.Browser.CDPEndpoint
		}

		// Merge launch options
		if overrides.Browser.LaunchOptions != nil {
			if result.Browser.LaunchOptions == nil {
				result.Browser.LaunchOptions = make(map[string]interface{})
			}

			for k, v := range overrides.Browser.LaunchOptions {
				result.Browser.LaunchOptions[k] = v
			}
		}

		// Merge context options
		if overrides.Browser.ContextOptions != nil {
			if result.Browser.ContextOptions == nil {
				result.Browser.ContextOptions = make(map[string]interface{})
			}

			for k, v := range overrides.Browser.ContextOptions {
				result.Browser.ContextOptions[k] = v
			}
		}
	}

	// Merge network config
	if overrides.Network != nil {
		if overrides.Network.AllowedOrigins != nil {
			result.Network.AllowedOrigins = overrides.Network.AllowedOrigins
		}

		if overrides.Network.BlockedOrigins != nil {
			result.Network.BlockedOrigins = overrides.Network.BlockedOrigins
		}
	}

	// Merge server config
	if overrides.Server != nil {
		if overrides.Server.Port != 0 {
			result.Server.Port = overrides.Server.Port
		}

		if overrides.Server.Host != "" {
			result.Server.Host = overrides.Server.Host
		}
	}

	// Merge other config options
	if overrides.Capabilities != nil {
		result.Capabilities = overrides.Capabilities
	}

	if overrides.Vision {
		result.Vision = true
	}

	if overrides.Extension {
		result.Extension = true
	}

	if overrides.SaveTrace {
		result.SaveTrace = true
	}

	if overrides.OutputDir != "" {
		result.OutputDir = overrides.OutputDir
	}

	if overrides.ImageResponses != "" {
		result.ImageResponses = overrides.ImageResponses
	}

	return &result, nil
}

// OutputFile returns a path for an output file
func OutputFile(config *FullConfig, name string) (string, error) {
	if err := os.MkdirAll(config.OutputDir, 0755); err != nil {
		return "", err
	}

	fileName := sanitizeForFilePath(name)
	return filepath.Join(config.OutputDir, fileName), nil
}
