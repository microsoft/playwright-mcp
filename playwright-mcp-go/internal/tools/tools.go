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

package tools

import (
	"encoding/json"

	"github.com/playwright-community/playwright-go"
	"github.com/pkg/errors"
)

// Tool is an interface for MCP tools
type Tool interface {
	// Name returns the name of the tool
	Name() string
	// Execute executes the tool with the given parameters
	Execute(params json.RawMessage) (interface{}, error)
}

// ToolRegistry is a registry of tools
type ToolRegistry struct {
	tools map[string]Tool
}

// NewToolRegistry creates a new tool registry
func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		tools: make(map[string]Tool),
	}
}

// Register registers a tool
func (r *ToolRegistry) Register(tool Tool) {
	r.tools[tool.Name()] = tool
}

// Get gets a tool by name
func (r *ToolRegistry) Get(name string) (Tool, bool) {
	tool, ok := r.tools[name]
	return tool, ok
}

// GetToolNames returns the names of all registered tools
func (r *ToolRegistry) GetToolNames() []string {
	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}
	return names
}

// NavigateTool implements the navigate tool
type NavigateTool struct {
	context playwright.BrowserContext
}

// NewNavigateTool creates a new navigate tool
func NewNavigateTool(context playwright.BrowserContext) *NavigateTool {
	return &NavigateTool{
		context: context,
	}
}

// NavigateParams are the parameters for the navigate tool
type NavigateParams struct {
	URL string `json:"url"`
}

// Name returns the name of the tool
func (t *NavigateTool) Name() string {
	return "navigate"
}

// Execute executes the tool
func (t *NavigateTool) Execute(params json.RawMessage) (interface{}, error) {
	var p NavigateParams
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, errors.Wrap(err, "failed to parse parameters")
	}

	if p.URL == "" {
		return nil, errors.New("url is required")
	}

	// Create a new page
	page, err := t.context.NewPage()
	if err != nil {
		return nil, errors.Wrap(err, "failed to create page")
	}

	// Navigate to the URL
	if _, err := page.Goto(p.URL); err != nil {
		return nil, errors.Wrap(err, "failed to navigate")
	}

	return map[string]string{
		"status": "success",
		"url":    page.URL(),
	}, nil
}
