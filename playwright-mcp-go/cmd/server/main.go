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

package main

import (
	"encoding/json"
	"flag"
	"os"

	"github.com/microsoft/playwright-mcp-go/internal/config"
	"github.com/microsoft/playwright-mcp-go/internal/httpserver"
	"github.com/microsoft/playwright-mcp-go/internal/server"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Set up logging
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Parse command line flags
	configFile := flag.String("config", "", "Path to config file")
	port := flag.Int("port", 3000, "Port to listen on")
	debug := flag.Bool("debug", false, "Enable debug logging")
	flag.Parse()

	// Set log level
	if *debug {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	// Initialize configuration
	var userConfig config.Config

	// If config file is provided, read it
	if *configFile != "" {
		configData, err := os.ReadFile(*configFile)
		if err != nil {
			log.Fatal().Err(err).Str("file", *configFile).Msg("Failed to read config file")
		}

		if err := json.Unmarshal(configData, &userConfig); err != nil {
			log.Fatal().Err(err).Str("file", *configFile).Msg("Failed to parse config file")
		}
	}

	// Resolve configuration
	fullConfig, err := config.ResolveConfig(userConfig)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to resolve configuration")
	}

	// Create server
	mcpServer, err := server.New(fullConfig)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create MCP server")
	}

	// Setup exit watchdog
	mcpServer.SetupExitWatchdog()

	// Run HTTP server
	log.Info().Msgf("Starting Playwright MCP server on port %d", *port)
	if err := httpserver.RunServer(mcpServer, *port); err != nil {
		log.Fatal().Err(err).Msg("HTTP server failed")
	}
}
