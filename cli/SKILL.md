---
name: playwright-cli
description: Browser automation tool that opens web pages and interacts with them. Use for filling forms, extracting information, testing web applications and general web browsing.
allowed-tools: Bash(playwright-cli:*)
---

# playwright-cli for browser automation

## Installation

```bash
npm i -g @playwright/cli@latest
playwright-cli install --with-deps    # Download browsers
```

## Quick reference

```bash
playwright-cli open <url>             # Open the page and load a URL
playwright-cli fill @e14 "query"      # Interact with page elements using refs from the snapshot
playwright-cli click @e26             # You can click, fill, hover, press keys and more
playwright-cli close                  # Close the page at the end
```

## Commands

```bash
playwright-cli click <ref>                             # perform click on a web page
playwright-cli close                                   # close the page
playwright-cli dblclick <ref>                          # perform double click on a web page
playwright-cli console <level>                         # returns all console messages
playwright-cli drag <startRef> <endRef>                # perform drag and drop between two elements
playwright-cli evaluate <function> <ref>               # evaluate javascript expression on page or element
playwright-cli upload-file                             # upload one or multiple files
playwright-cli handle-dialog <accept> <promptText>     # handle a dialog
playwright-cli hover <ref>                             # hover over element on page
playwright-cli open <url>                              # open url
playwright-cli go-back                                 # go back to the previous page
playwright-cli network-requests                        # returns all network requests since loading the page
playwright-cli press-key <key>                         # press a key on the keyboard
playwright-cli resize <width> <height>                 # resize the browser window
playwright-cli run-code <code>                         # run playwright code snippet
playwright-cli select-option <ref> <values>            # select an option in a dropdown
playwright-cli snapshot                                # capture accessibility snapshot of the current page, this is better than screenshot
playwright-cli screenshot <ref>                        # take a screenshot of the current page. you can't perform actions based on the screenshot, use browser_snapshot for actions.
playwright-cli type <ref> <text>                       # type text into editable element
playwright-cli wait-for                                # wait for text to appear or disappear or a specified time to pass
playwright-cli tab <action> <index>                    # close a browser tab
playwright-cli mouse-click-xy <x> <y>                  # click left mouse button at a given position
playwright-cli mouse-drag-xy <startX> <startY> <endX> <endY> # drag left mouse button to a given position
playwright-cli mouse-move-xy <x> <y>                   # move mouse to a given position
playwright-cli pdf-save                                # save page as pdf
playwright-cli start-tracing                           # start trace recording
playwright-cli stop-tracing                            # stop trace recording
```

## Multiple sessions

Open pages in separate browsers, isolated from each other.

```bash
playwright-cli --session alice open chat.example.com
playwright-cli --session bob open chat.example.com
# ... interact with both sessions ...
playwright-cli --session alice close
playwright-cli --session bob close
```
