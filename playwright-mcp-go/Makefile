# Makefile for Playwright MCP Go

.PHONY: build run test clean install-deps

# Binary output
BINARY_NAME=playwright-mcp
BUILD_DIR=bin

# Go build flags
GO_FLAGS=-v

# Default target
all: build

# Install dependencies
install-deps:
	go mod tidy
	go install github.com/playwright-community/playwright-go/cmd/playwright@latest
	$(GOPATH)/bin/playwright install

# Build the project
build: install-deps
	mkdir -p $(BUILD_DIR)
	go build $(GO_FLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server

# Run the project
run: build
	$(BUILD_DIR)/$(BINARY_NAME)

# Run tests
test:
	go test -v ./...

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)
