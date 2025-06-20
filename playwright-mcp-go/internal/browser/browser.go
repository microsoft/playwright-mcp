package browser

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Browser represents a browser instance
type Browser interface {
	NewContext(options map[string]interface{}) (BrowserContext, error)
	Close() error
}

// BrowserType represents a browser type (chromium, firefox, webkit)
type BrowserType string

const (
	BrowserTypeChromium BrowserType = "chromium"
	BrowserTypeFirefox  BrowserType = "firefox"
	BrowserTypeWebkit   BrowserType = "webkit"
)

// LaunchPersistentContextOptions represents options for launching a persistent context
type LaunchPersistentContextOptions struct {
	UserDataDir    string
	LaunchOptions  map[string]interface{}
	ContextOptions map[string]interface{}
	HandleSIGINT   bool
	HandleSIGTERM  bool
}

// BrowserInfo represents information about a browser
type BrowserInfo struct {
	BrowserType    string                 `json:"browserType"`
	UserDataDir    string                 `json:"userDataDir"`
	CDPPort        int                    `json:"cdpPort"`
	LaunchOptions  map[string]interface{} `json:"launchOptions"`
	ContextOptions map[string]interface{} `json:"contextOptions"`
	Error          string                 `json:"error,omitempty"`
}

// LaunchBrowserRequest represents a request to launch a browser
type LaunchBrowserRequest struct {
	BrowserType    string                 `json:"browserType"`
	UserDataDir    string                 `json:"userDataDir"`
	LaunchOptions  map[string]interface{} `json:"launchOptions"`
	ContextOptions map[string]interface{} `json:"contextOptions"`
}

// BrowserManager manages browser instances
type BrowserManager struct {
	browsers map[string]Browser
}

// NewBrowserManager creates a new BrowserManager
func NewBrowserManager() *BrowserManager {
	return &BrowserManager{
		browsers: make(map[string]Browser),
	}
}

// LaunchBrowser launches a browser
func (m *BrowserManager) LaunchBrowser(request *LaunchBrowserRequest) (*BrowserInfo, error) {
	// Find a free port for CDP
	cdpPort, err := findFreePort()
	if err != nil {
		return nil, fmt.Errorf("failed to find free port: %w", err)
	}

	// Set CDP port in launch options
	if request.LaunchOptions == nil {
		request.LaunchOptions = make(map[string]interface{})
	}
	request.LaunchOptions["cdpPort"] = cdpPort

	// Create browser info
	info := &BrowserInfo{
		BrowserType:    request.BrowserType,
		UserDataDir:    request.UserDataDir,
		CDPPort:        cdpPort,
		LaunchOptions:  request.LaunchOptions,
		ContextOptions: request.ContextOptions,
	}

	// Launch browser
	browser, err := m.launchBrowserByType(request)
	if err != nil {
		info.Error = err.Error()
		return info, nil
	}

	// Store browser
	m.browsers[request.UserDataDir] = browser

	return info, nil
}

// GetBrowserInfo returns information about a browser
func (m *BrowserManager) GetBrowserInfo(userDataDir string) (*BrowserInfo, bool) {
	browser, ok := m.browsers[userDataDir]
	if !ok {
		return nil, false
	}

	// This is a placeholder implementation
	// In a real implementation, we would get the actual browser info
	return &BrowserInfo{
		BrowserType: "chromium",
		UserDataDir: userDataDir,
		CDPPort:     0,
	}, true
}

// CloseBrowser closes a browser
func (m *BrowserManager) CloseBrowser(userDataDir string) error {
	browser, ok := m.browsers[userDataDir]
	if !ok {
		return errors.New("browser not found")
	}

	err := browser.Close()
	if err != nil {
		return err
	}

	delete(m.browsers, userDataDir)
	return nil
}

// CloseAllBrowsers closes all browsers
func (m *BrowserManager) CloseAllBrowsers() error {
	var errs []string

	for userDataDir, browser := range m.browsers {
		err := browser.Close()
		if err != nil {
			errs = append(errs, fmt.Sprintf("failed to close browser %s: %v", userDataDir, err))
		}
	}

	m.browsers = make(map[string]Browser)

	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}

	return nil
}

// launchBrowserByType launches a browser by type
func (m *BrowserManager) launchBrowserByType(request *LaunchBrowserRequest) (Browser, error) {
	// This is a placeholder implementation
	// In a real implementation, we would launch the browser using CDP
	return nil, errors.New("not implemented")
}

// findFreePort finds a free port
func findFreePort() (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

// findChromePath finds the path to Chrome
func findChromePath() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		paths := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
		for _, path := range paths {
			if _, err := exec.LookPath(path); err == nil {
				return path, nil
			}
		}
	case "linux":
		paths := []string{
			"google-chrome",
			"chromium",
			"chromium-browser",
		}
		for _, path := range paths {
			if p, err := exec.LookPath(path); err == nil {
				return p, nil
			}
		}
	case "windows":
		paths := []string{
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("LocalAppData"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(os.Getenv("LocalAppData"), "Microsoft", "Edge", "Application", "msedge.exe"),
		}
		for _, path := range paths {
			if _, err := exec.LookPath(path); err == nil {
				return path, nil
			}
		}
	}

	return "", errors.New("Chrome not found")
}
