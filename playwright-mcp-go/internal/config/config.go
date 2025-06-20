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

package config

import (
	"encoding/json"
)

// BrowserConfig contains browser-specific configuration
type BrowserConfig struct {
	// The browser to use (chromium, firefox, webkit)
	Name string `json:"name"`
	// Whether to run in headless mode (default true)
	Headless *bool `json:"headless,omitempty"`
	// Custom browser executable path
	ExecutablePath string `json:"executablePath,omitempty"`
	// Custom browser arguments
	Args []string `json:"args,omitempty"`
	// Custom browser channel
	Channel string `json:"channel,omitempty"`
	// Slow motion delay in milliseconds
	SlowMo int `json:"slowMo,omitempty"`
}

// Config represents the user-provided configuration
type Config struct {
	// Browser configuration
	Browser BrowserConfig `json:"browser"`
}

// FullConfig represents the fully resolved configuration
type FullConfig struct {
	// Browser configuration
	Browser BrowserConfig `json:"browser"`
}

// DefaultBrowserConfig returns the default browser configuration
func DefaultBrowserConfig() BrowserConfig {
	headless := true
	return BrowserConfig{
		Name:     "chromium",
		Headless: &headless,
		Args:     []string{},
	}
}

// ResolveConfig merges user config with defaults
func ResolveConfig(userConfig Config) (*FullConfig, error) {
	// Start with defaults
	defaultConfig := Config{
		Browser: DefaultBrowserConfig(),
	}

	// Merge with user config
	if userConfig.Browser.Name != "" {
		defaultConfig.Browser.Name = userConfig.Browser.Name
	}

	if userConfig.Browser.Headless != nil {
		defaultConfig.Browser.Headless = userConfig.Browser.Headless
	}

	if userConfig.Browser.ExecutablePath != "" {
		defaultConfig.Browser.ExecutablePath = userConfig.Browser.ExecutablePath
	}

	if userConfig.Browser.Channel != "" {
		defaultConfig.Browser.Channel = userConfig.Browser.Channel
	}

	if userConfig.Browser.SlowMo != 0 {
		defaultConfig.Browser.SlowMo = userConfig.Browser.SlowMo
	}

	if len(userConfig.Browser.Args) > 0 {
		defaultConfig.Browser.Args = append(defaultConfig.Browser.Args, userConfig.Browser.Args...)
	}

	return &FullConfig{
		Browser: defaultConfig.Browser,
	}, nil
}

// ParseConfig parses configuration from JSON
func ParseConfig(jsonConfig string) (*Config, error) {
	config := &Config{}
	if err := json.Unmarshal([]byte(jsonConfig), config); err != nil {
		return nil, err
	}
	return config, nil
}
