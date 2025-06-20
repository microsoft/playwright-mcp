package server

type BrowserInfo struct {
	BrowserType   string      `json:"browserType"`
	UserDataDir   string      `json:"userDataDir"`
	CDPPort       int         `json:"cdpPort"`
	LaunchOptions interface{} `json:"launchOptions"`
	ContextOptions interface{} `json:"contextOptions"`
	Error         string      `json:"error,omitempty"`
}

type BrowserEntry struct {
	Info BrowserInfo
	// Add more fields as needed (e.g., process handle)
}

type BrowserManager struct {
	entries []BrowserEntry
}

func NewBrowserManager() *BrowserManager {
	return &BrowserManager{entries: []BrowserEntry{}}
}

func (bm *BrowserManager) List() []BrowserInfo {
	list := make([]BrowserInfo, len(bm.entries))
	for i, entry := range bm.entries {
		list[i] = entry.Info
	}
	return list
}

type LaunchBrowserRequest struct {
	BrowserType    string      `json:"browserType"`
	UserDataDir    string      `json:"userDataDir"`
	LaunchOptions  interface{} `json:"launchOptions"`
	ContextOptions interface{} `json:"contextOptions"`
}

func (bm *BrowserManager) Launch(req LaunchBrowserRequest) BrowserInfo {
	// In a real implementation, this would launch a browser process and manage it.
	// For now, just mock a CDP port and store the info.
	info := BrowserInfo{
		BrowserType:    req.BrowserType,
		UserDataDir:    req.UserDataDir,
		CDPPort:        9225 + len(bm.entries), // mock port
		LaunchOptions:  req.LaunchOptions,
		ContextOptions: req.ContextOptions,
		Error:          "", // no error
	}
	bm.entries = append(bm.entries, BrowserEntry{Info: info})
	return info
}

// TODO: Add methods for launching browsers, etc. 