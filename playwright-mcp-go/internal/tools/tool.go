package tools

import (
	"github.com/microsoft/playwright-mcp-go/internal/config"
)

// ModalStateType represents the type of modal state
type ModalStateType string

const (
	ModalStateTypeFileChooser ModalStateType = "fileChooser"
	ModalStateTypeDialog      ModalStateType = "dialog"
)

// ContentType represents the type of content in a tool result
type ContentType string

const (
	ContentTypeText  ContentType = "text"
	ContentTypeImage ContentType = "image"
)

// Content represents a piece of content in a tool result
type Content struct {
	Type ContentType `json:"type"`
	Text string      `json:"text,omitempty"`
	// For image content
	URL         string `json:"url,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
	Width       int    `json:"width,omitempty"`
	Height      int    `json:"height,omitempty"`
	Data        string `json:"data,omitempty"` // Base64 encoded image data
	Description string `json:"description,omitempty"`
}

// ToolActionResult represents the result of a tool action
type ToolActionResult struct {
	Content []Content `json:"content,omitempty"`
	IsError bool      `json:"isError,omitempty"`
}

// ToolResult represents the result of a tool execution
type ToolResult struct {
	Code            []string
	Action          func() (*ToolActionResult, error)
	CaptureSnapshot bool
	WaitForNetwork  bool
	ResultOverride  *ToolActionResult
}

// FileUploadModalState represents a file upload modal state
type FileUploadModalState struct {
	Type        ModalStateType `json:"type"`
	Description string         `json:"description"`
	// In Go, we'll need to define a FileChooser interface or struct
	FileChooser interface{} `json:"-"`
}

// DialogModalState represents a dialog modal state
type DialogModalState struct {
	Type        ModalStateType `json:"type"`
	Description string         `json:"description"`
	// In Go, we'll need to define a Dialog interface or struct
	Dialog interface{} `json:"-"`
}

// ModalState represents a modal state
type ModalState interface {
	GetType() ModalStateType
	GetDescription() string
}

// Implementation of ModalState for FileUploadModalState
func (s *FileUploadModalState) GetType() ModalStateType {
	return s.Type
}

func (s *FileUploadModalState) GetDescription() string {
	return s.Description
}

// Implementation of ModalState for DialogModalState
func (s *DialogModalState) GetType() ModalStateType {
	return s.Type
}

func (s *DialogModalState) GetDescription() string {
	return s.Description
}

// SchemaType represents the type of a tool schema
type SchemaType string

const (
	SchemaTypeReadOnly    SchemaType = "readOnly"
	SchemaTypeDestructive SchemaType = "destructive"
)

// ToolSchema represents the schema of a tool
type ToolSchema struct {
	Name        string     `json:"name"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Type        SchemaType `json:"type"`
	// In Go, we'll need to define a JSON schema validator
	InputSchema interface{} `json:"-"`
}

// Context represents the context in which tools are executed
type Context interface {
	// Add methods that tools need to interact with the browser
	ModalStates() []ModalState
	SetModalState(modalState ModalState, inTab interface{})
	ClearModalState(modalState ModalState)
	ModalStatesMarkdown() []string
	Tabs() []interface{}
	CurrentTabOrDie() interface{}
	NewTab() (interface{}, error)
	SelectTab(index int) error
	EnsureTab() (interface{}, error)
	ListTabsMarkdown() (string, error)
	CloseTab(index int) (string, error)
	WaitForTimeout(time int) error
	ClientSupportsImages() bool
}

// Tool represents a tool that can be executed
type Tool interface {
	GetCapability() config.ToolCapability
	GetSchema() *ToolSchema
	GetClearsModalState() ModalStateType
	Handle(ctx Context, params map[string]interface{}) (*ToolResult, error)
}

// BaseTool provides a base implementation of Tool
type BaseTool struct {
	Capability       config.ToolCapability
	Schema           *ToolSchema
	ClearsModalState ModalStateType
	HandleFunc       func(ctx Context, params map[string]interface{}) (*ToolResult, error)
}

// GetCapability returns the capability of the tool
func (t *BaseTool) GetCapability() config.ToolCapability {
	return t.Capability
}

// GetSchema returns the schema of the tool
func (t *BaseTool) GetSchema() *ToolSchema {
	return t.Schema
}

// GetClearsModalState returns the modal state that the tool clears
func (t *BaseTool) GetClearsModalState() ModalStateType {
	return t.ClearsModalState
}

// Handle handles the execution of the tool
func (t *BaseTool) Handle(ctx Context, params map[string]interface{}) (*ToolResult, error) {
	return t.HandleFunc(ctx, params)
}

// NewTool creates a new tool
func NewTool(
	capability config.ToolCapability,
	schema *ToolSchema,
	clearsModalState ModalStateType,
	handleFunc func(ctx Context, params map[string]interface{}) (*ToolResult, error),
) Tool {
	return &BaseTool{
		Capability:       capability,
		Schema:           schema,
		ClearsModalState: clearsModalState,
		HandleFunc:       handleFunc,
	}
}
