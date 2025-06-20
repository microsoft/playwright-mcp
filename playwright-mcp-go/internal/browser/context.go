package browser

import (
	"errors"

	"github.com/microsoft/playwright-mcp-go/internal/config"
)

// BrowserContext represents a browser context
type BrowserContext interface {
	NewPage() (interface{}, error)
	Close() error
	Browser() interface{}
}

// BrowserContextFactory creates browser contexts
type BrowserContextFactory interface {
	CreateContext() (BrowserContextWithClose, error)
}

// BrowserContextWithClose represents a browser context with a close function
type BrowserContextWithClose struct {
	BrowserContext BrowserContext
	Close          func() error
}

// SimpleBrowserContextFactory is a simple implementation of BrowserContextFactory
type SimpleBrowserContextFactory struct {
	contextGetter func() (BrowserContext, error)
}

// NewSimpleBrowserContextFactory creates a new SimpleBrowserContextFactory
func NewSimpleBrowserContextFactory(contextGetter func() (BrowserContext, error)) *SimpleBrowserContextFactory {
	return &SimpleBrowserContextFactory{
		contextGetter: contextGetter,
	}
}

// CreateContext creates a browser context
func (f *SimpleBrowserContextFactory) CreateContext() (BrowserContextWithClose, error) {
	browserContext, err := f.contextGetter()
	if err != nil {
		return BrowserContextWithClose{}, err
	}

	return BrowserContextWithClose{
		BrowserContext: browserContext,
		Close:          browserContext.Close,
	}, nil
}

// CDPBrowserContextFactory creates browser contexts using CDP
type CDPBrowserContextFactory struct {
	browserConfig config.BrowserConfig
}

// NewCDPBrowserContextFactory creates a new CDPBrowserContextFactory
func NewCDPBrowserContextFactory(browserConfig config.BrowserConfig) *CDPBrowserContextFactory {
	return &CDPBrowserContextFactory{
		browserConfig: browserConfig,
	}
}

// CreateContext creates a browser context using CDP
func (f *CDPBrowserContextFactory) CreateContext() (BrowserContextWithClose, error) {
	// This will be implemented using the CDP client
	// For now, we'll just return a placeholder
	return BrowserContextWithClose{}, errors.New("not implemented")
}

// ContextFactory returns a BrowserContextFactory based on the browser configuration
func ContextFactory(browserConfig config.BrowserConfig) (BrowserContextFactory, error) {
	return NewCDPBrowserContextFactory(browserConfig), nil
}
