package server

import "fmt"

type EchoTool struct{}

func (e *EchoTool) Name() string        { return "echo" }
func (e *EchoTool) Description() string { return "Echoes the input arguments" }
func (e *EchoTool) Call(args map[string]interface{}) (interface{}, error) {
	return fmt.Sprintf("Echo: %v", args), nil
} 