package tools

import (
	"errors"
	"fmt"

	"github.com/microsoft/playwright-mcp-go/internal/config"
)

// ErrInvalidParams is returned when invalid parameters are provided
var ErrInvalidParams = errors.New("invalid parameters")

// NavigateTool represents a tool for navigating to a URL
func NavigateTool(captureSnapshot bool) Tool {
	return NewTool(
		config.CapabilityCore,
		&ToolSchema{
			Name:        "browser_navigate",
			Title:       "Navigate to a URL",
			Description: "Navigate to a URL",
			Type:        SchemaTypeDestructive,
			// In a real implementation, we would use a JSON schema validator
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"url": map[string]interface{}{
						"type":        "string",
						"description": "The URL to navigate to",
					},
				},
				"required": []string{"url"},
			},
		},
		"",
		func(ctx Context, params map[string]interface{}) (*ToolResult, error) {
			// Get URL from params
			url, ok := params["url"].(string)
			if !ok {
				return nil, ErrInvalidParams
			}

			// Get tab
			tab, err := ctx.EnsureTab()
			if err != nil {
				return nil, err
			}

			// In a real implementation, we would cast tab to the correct type
			// and call Navigate on it
			fmt.Printf("Navigating to %s in tab %v\n", url, tab)

			// Create code
			code := []string{
				"// Navigate to " + url,
				"await page.goto('" + url + "');",
			}

			return &ToolResult{
				Code:            code,
				CaptureSnapshot: captureSnapshot,
				WaitForNetwork:  false,
			}, nil
		},
	)
}

// GoBackTool represents a tool for going back in the browser history
func GoBackTool(captureSnapshot bool) Tool {
	return NewTool(
		config.CapabilityHistory,
		&ToolSchema{
			Name:        "browser_navigate_back",
			Title:       "Go back",
			Description: "Go back to the previous page",
			Type:        SchemaTypeReadOnly,
			// In a real implementation, we would use a JSON schema validator
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		"",
		func(ctx Context, params map[string]interface{}) (*ToolResult, error) {
			// Get tab
			tab := ctx.CurrentTabOrDie()

			// In a real implementation, we would cast tab to the correct type
			// and call GoBack on it
			fmt.Printf("Going back in tab %v\n", tab)

			// Create code
			code := []string{
				"// Navigate back",
				"await page.goBack();",
			}

			return &ToolResult{
				Code:            code,
				CaptureSnapshot: captureSnapshot,
				WaitForNetwork:  false,
			}, nil
		},
	)
}

// GoForwardTool represents a tool for going forward in the browser history
func GoForwardTool(captureSnapshot bool) Tool {
	return NewTool(
		config.CapabilityHistory,
		&ToolSchema{
			Name:        "browser_navigate_forward",
			Title:       "Go forward",
			Description: "Go forward to the next page",
			Type:        SchemaTypeReadOnly,
			// In a real implementation, we would use a JSON schema validator
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		"",
		func(ctx Context, params map[string]interface{}) (*ToolResult, error) {
			// Get tab
			tab := ctx.CurrentTabOrDie()

			// In a real implementation, we would cast tab to the correct type
			// and call GoForward on it
			fmt.Printf("Going forward in tab %v\n", tab)

			// Create code
			code := []string{
				"// Navigate forward",
				"await page.goForward();",
			}

			return &ToolResult{
				Code:            code,
				CaptureSnapshot: captureSnapshot,
				WaitForNetwork:  false,
			}, nil
		},
	)
}

// NavigateTools returns all navigate tools
func NavigateTools(captureSnapshot bool) []Tool {
	return []Tool{
		NavigateTool(captureSnapshot),
		GoBackTool(captureSnapshot),
		GoForwardTool(captureSnapshot),
	}
}
