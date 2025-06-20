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

package browser

import (
	"github.com/microsoft/playwright-mcp-go/internal/config"
	"github.com/pkg/errors"
	"github.com/playwright-community/playwright-go"
)

// BrowserContext represents a browser context with its associated resources
type BrowserContext struct {
	// The playwright browser context
	Context playwright.BrowserContext
	// Function to close the browser context
	Close func() error
}

// ContextFactory is an interface for creating browser contexts
type ContextFactory interface {
	// CreateContext creates a new browser context
	CreateContext() (*BrowserContext, error)
}

// PlaywrightContextFactory creates browser contexts from Playwright
type PlaywrightContextFactory struct {
	browserConfig config.BrowserConfig
	pw            *playwright.Playwright
	browser       playwright.Browser
}

// NewContextFactory creates a new browser context factory
func NewContextFactory(browserConfig config.BrowserConfig) (ContextFactory, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, errors.Wrap(err, "could not start playwright")
	}

	var browser playwright.Browser
	launchOptions := playwright.BrowserTypeLaunchOptions{
		Headless:       browserConfig.Headless,
		SlowMo:         playwright.Float(float64(browserConfig.SlowMo)),
		Channel:        playwright.String(browserConfig.Channel),
		ExecutablePath: playwright.String(browserConfig.ExecutablePath),
		Args:           browserConfig.Args,
	}

	switch browserConfig.Name {
	case "chromium":
		browser, err = pw.Chromium.Launch(launchOptions)
	case "firefox":
		browser, err = pw.Firefox.Launch(launchOptions)
	case "webkit":
		browser, err = pw.WebKit.Launch(launchOptions)
	default:
		return nil, errors.Errorf("unsupported browser: %s", browserConfig.Name)
	}

	if err != nil {
		pw.Stop()
		return nil, errors.Wrap(err, "could not launch browser")
	}

	return &PlaywrightContextFactory{
		browserConfig: browserConfig,
		pw:            pw,
		browser:       browser,
	}, nil
}

// CreateContext creates a new browser context
func (f *PlaywrightContextFactory) CreateContext() (*BrowserContext, error) {
	context, err := f.browser.NewContext()
	if err != nil {
		return nil, errors.Wrap(err, "could not create browser context")
	}

	return &BrowserContext{
		Context: context,
		Close: func() error {
			if err := context.Close(); err != nil {
				return err
			}
			return nil
		},
	}, nil
}

// Close closes the browser and stops playwright
func (f *PlaywrightContextFactory) Close() error {
	if err := f.browser.Close(); err != nil {
		return errors.Wrap(err, "could not close browser")
	}
	if err := f.pw.Stop(); err != nil {
		return errors.Wrap(err, "could not stop playwright")
	}
	return nil
}
