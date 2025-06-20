package browser

import (
	"errors"
	"fmt"
)

// PageSnapshot represents a snapshot of a page
type PageSnapshot struct {
	TextContent string
	HTMLContent string
	HasImage    bool
	ImageURL    string
}

// Tab represents a browser tab
type Tab struct {
	Page            interface{} // This will be the actual CDP page implementation
	snapshot        *PageSnapshot
	pendingSnapshot *PageSnapshot
}

// NewTab creates a new tab
func NewTab(page interface{}) *Tab {
	return &Tab{
		Page: page,
	}
}

// Navigate navigates to a URL
func (t *Tab) Navigate(url string) error {
	// This will be implemented using the CDP client
	// For now, we'll just return a placeholder
	return errors.New("not implemented")
}

// Title returns the title of the page
func (t *Tab) Title() (string, error) {
	// This will be implemented using the CDP client
	// For now, we'll just return a placeholder
	return "Page Title", nil
}

// CaptureSnapshot captures a snapshot of the page
func (t *Tab) CaptureSnapshot() error {
	// This will be implemented using the CDP client
	// For now, we'll just create a placeholder snapshot
	t.snapshot = &PageSnapshot{
		TextContent: "Page content",
		HTMLContent: "<html><body>Page content</body></html>",
	}
	return nil
}

// HasSnapshot returns whether the tab has a snapshot
func (t *Tab) HasSnapshot() bool {
	return t.snapshot != nil
}

// SnapshotOrDie returns the snapshot or panics if there is no snapshot
func (t *Tab) SnapshotOrDie() *PageSnapshot {
	if t.snapshot == nil {
		panic("No snapshot available")
	}
	return t.snapshot
}

// Text returns the text of the page snapshot
func (ps *PageSnapshot) Text() string {
	return ps.TextContent
}

// HTML returns the HTML of the page snapshot
func (ps *PageSnapshot) HTML() string {
	return ps.HTMLContent
}

// String returns a string representation of the page snapshot
func (ps *PageSnapshot) String() string {
	return fmt.Sprintf("PageSnapshot{Text: %s, HTML: %s}", ps.TextContent, ps.HTMLContent)
}
