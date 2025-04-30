import { test, expect, navigateAndGetSnapshot, extractRef } from './fixtures';
import {
  navigate,
  click,
  selectOption,
  close,
  snapshot,
  chooseFile,
  goBack,
  goForward,
  wait,
  pressKey,
  pdf,
  drag,
  hover,
  type,
  screenshot as coreScreenshot,
} from '@leantest/core';
import fs from 'fs/promises';

test('test browser navigate', async ({ coreContext }) => {
  const snapshotText = await navigateAndGetSnapshot(coreContext, '<title>Navigate Page</title><body>Navigate Body</body>');
  expect(snapshotText).toContain('- Page Title: Navigate Page');
  expect(snapshotText).toMatch(/document.*: Navigate Body/);
});

test('test browser goBack', async ({ coreContext }) => {
  await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Page 1</title>' });
  await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Page 2</title>' });

  const goBackTool = goBack(true);
  const result = await goBackTool.handle(coreContext);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Navigated back') &&
            expect.stringContaining('- Page Title: Page 1')
  }));
});

test('test browser goForward', async ({ coreContext }) => {
  await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Page A</title>' });
  await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Page B</title>' });
  await goBack(true).handle(coreContext);

  const goForwardTool = goForward(true);
  const result = await goForwardTool.handle(coreContext);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Navigated forward') &&
            expect.stringContaining('- Page Title: Page B')
  }));
});

test('test browser wait', async ({ coreContext }) => {
  await navigate(false).handle(coreContext, { url: 'data:text/html,<body>Wait Test</body>' });

  const waitTool = wait;
  const params = { time: 0.1 };
  const result = await waitTool.handle(coreContext, params);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: 'Waited for 0.1 seconds'
  }));
  expect(coreContext.existingPage()).toBeDefined();
});

test('test browser pressKey', async ({ coreContext }) => {
  await navigate(false).handle(coreContext, { url: 'data:text/html,<input type="text">' });
  await coreContext.existingPage().locator('input').focus();

  const pressKeyTool = pressKey;
  const params = { key: 'A' };
  const result = await pressKeyTool.handle(coreContext, params);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: 'Pressed key A'
  }));
  await expect(coreContext.existingPage().locator('input')).toHaveValue('A');
});

test('test browser save_as_pdf', async ({ coreContext }) => {
  await navigate(false).handle(coreContext, { url: 'data:text/html,<body>PDF Content</body>' });

  const pdfTool = pdf;
  const result = await pdfTool.handle(coreContext);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Saved as ') && expect.stringContaining('.pdf')
  }));
});

test('test browser close', async ({ coreContext }) => {
  await navigate(false).handle(coreContext, { url: 'data:text/html,<body>Close Me</body>' });
  expect(coreContext.existingPage()).toBeDefined();

  const closeTool = close;
  const result = await closeTool.handle(coreContext);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: 'Page closed'
  }));
});

test('test browser choose file', async ({ coreContext }, testInfo) => {
  await navigate(true).handle(coreContext, { url: 'data:text/html,<title>File Upload</title><input type="file">' });

  const filePath = testInfo.outputPath('upload.txt');
  await fs.writeFile(filePath, 'upload content');

  const page = coreContext.existingPage();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('input[type="file"]').click();
  await fileChooserPromise;

  const chooseFileTool = chooseFile(true);
  const params = { paths: [filePath] };
  const result = await chooseFileTool.handle(coreContext, params);

  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Chose files') &&
            expect.stringContaining('upload.txt') &&
            expect.stringMatching(/textbox \[ref=s\de\d+\]: C:\\fakepath\\upload.txt/)
  }));
  await expect(page.locator('input[type="file"]')).toHaveValue(/upload\.txt/);
});

test('test browser snapshot', async ({ coreContext }) => {
  await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Snapshot Page</title><h1>Snapshot Header</h1>' });

  const snapshotTool = snapshot;
  const result = await snapshotTool.handle(coreContext);
  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('- Page Title: Snapshot Page') &&
            expect.stringContaining('Page Snapshot') &&
            expect.stringMatching(/heading "Snapshot Header"/)
  }));
});

test('test browser click (snapshot tool)', async ({ coreContext }) => {
  const navResult = await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Click Test</title><button>My Button</button>' });
  const textResult = navResult.content[0].text;
  const match = textResult.match(/button "My Button" \[ref=(.*?)\]/);
  expect(match).not.toBeNull();
  const buttonRef = match![1];

  const clickTool = click;
  const params = { element: 'My Button', ref: buttonRef };
  const result = await clickTool.handle(coreContext, params, true);

  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('"My Button" clicked') &&
            expect.stringContaining('- Page Title: Click Test')
  }));
});

test('test browser hover', async ({ coreContext }) => {
  const html = '<title>Hover Test</title><div role="region" aria-label="Hover Area" id="hoverable">Hover Area Content</div>';
  const snapshotText = await navigateAndGetSnapshot(coreContext, html);
  const divRef = extractRef(snapshotText, /region "Hover Area" \[ref=(.*?)\]/);

  const hoverTool = hover;
  const params = { element: 'Hover Area', ref: divRef };
  const result = await hoverTool.handle(coreContext, params, true);

  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Hovered over "Hover Area"') &&
            expect.stringContaining('- Page Title: Hover Test')
  }));
});

test('test browser type', async ({ coreContext }) => {
  const snapshotText = await navigateAndGetSnapshot(coreContext, '<title>Type Test</title><input type="text">');
  const inputRef = extractRef(snapshotText, /textbox \[ref=(.*?)\]/);

  const typeTool = type;
  const params = { element: 'Textbox', ref: inputRef, text: 'Typed Text', submit: false };
  const result = await typeTool.handle(coreContext, params, true);

  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Typed "Typed Text" into "Textbox"') &&
            expect.stringContaining('- Page Title: Type Test') &&
            expect.stringMatching(/textbox \[ref=s\de\d+\]: Typed Text/)
  }));
  await expect(coreContext.existingPage().locator('input')).toHaveValue('Typed Text');
});

test('test browser selectOption', async ({ coreContext }) => {
  const navResult = await navigate(true).handle(coreContext, { url: 'data:text/html,<title>Select Test</title><select><option value="v1">Opt1</option><option value="v2">Opt2</option></select>' });
  const textResult = navResult.content[0].text;
  const match = textResult.match(/combobox \[ref=(.*?)\]/);
  expect(match).not.toBeNull();
  const selectRef = match![1];

  const selectTool = selectOption;
  const params = { element: 'Combobox', ref: selectRef, values: ['v2'] };
  const result = await selectTool.handle(coreContext, params, true);

  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'text',
    text: expect.stringContaining('Selected option in "Combobox"') &&
            expect.stringContaining('- Page Title: Select Test') &&
            expect.stringMatching(/option "Opt2" \[selected\]/)
  }));
  await expect(coreContext.existingPage().locator('select')).toHaveValue('v2');
});

test('test browser screenshot (jpeg)', async ({ coreContext }) => {
  await navigate(false).handle(coreContext, { url: 'data:text/html,<title>Screenshot Page</title><h1>Screenshot Content</h1>' });

  const screenshotTool = coreScreenshot;
  const result = await screenshotTool.handle(coreContext);

  expect(result.content[0]).toEqual(expect.objectContaining({
    type: 'image',
    mimeType: 'image/jpeg',
    data: expect.any(String)
  }));
  expect(result.content[0].data?.length).toBeGreaterThan(100);
});

test('test browser drag', async ({ coreContext }) => {
  const html = `
    <title>Drag</title>
    <div role="region" aria-label="S" id="src">Source Content</div>
    <div role="region" aria-label="T" id="tgt">Target Content</div>
  `;
  const snapshotText = await navigateAndGetSnapshot(coreContext, html);
  const sourceRef = extractRef(snapshotText, /region "S" \[ref=(.*?)\]/);
  const targetRef = extractRef(snapshotText, /region "T" \[ref=(.*?)\]/);

  const params = {
    startElement: 'S', startRef: sourceRef,
    endElement: 'T', endRef: targetRef
  };
  const result = await drag.handle(coreContext, params, true);

  expect(result.content[0].text).toContain('Dragged "S" to "T"');
});
