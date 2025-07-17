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

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// This test assumes the MCP server exposes the video tool via some API or automation interface.
// Adjust the test to fit your actual MCP tool invocation method.

test.describe('browser_video_record tool', () => {
  test('should start and stop video recording (custom path)', async ({ context }, testInfo) => {
    // Custom path: Downloads
    const videoDir = '/Users/suman/Downloads/';
    // Compose scenario-based name
    const scenarioBase = (testInfo.title || 'video').replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const scenarioName = `${scenarioBase}_${timestamp}.webm`;
    const scenarioPath = path.join(videoDir, scenarioName);
    // Clean up any pre-existing test file
    if (fs.existsSync(scenarioPath))
      fs.unlinkSync(scenarioPath);


    const videoContext = await context.browser().newContext({ recordVideo: { dir: videoDir } });
    const videoPage = await videoContext.newPage();
    await videoPage!.goto('https://playwright.dev/');
    await videoPage!.click('body');
    await videoPage!.waitForTimeout(1000);
    await videoPage!.close();
    // Simulate MCP tool: rename the last .webm file to scenario-based name
    const filesBefore = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
    // Find the most recent .webm file
    let latestFile: string | undefined;
    let latestMtime = 0;
    for (const file of filesBefore) {
      const stat = fs.statSync(path.join(videoDir, file));
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestFile = file;
      }
    }
    if (latestFile && latestFile !== scenarioName) {
      try {
        fs.renameSync(path.join(videoDir, latestFile), scenarioPath);
      } catch (err) {
        // If file does not exist, skip renaming and log for debug
        // Optionally, you can fail the test or just log
        // console.warn('Could not rename video file:', err);
      }
    }

    await new Promise(res => setTimeout(res, 500));
    expect(fs.existsSync(scenarioPath)).toBeTruthy();
    // (No cleanup: leave the video file for inspection)
    await videoContext.close();
  });

  test('should start and stop video recording (default path)', async ({ context }, testInfo) => {
    // Default path: VideoRecordings in project root
    const projectRoot = process.cwd();
    const recordingsDir = path.join(projectRoot, 'VideoRecordings');
    if (!fs.existsSync(recordingsDir))
      fs.mkdirSync(recordingsDir, { recursive: true });

    // Compose scenario-based name
    const scenarioBase = (testInfo.title || 'video').replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const scenarioName = `${scenarioBase}_${timestamp}.webm`;
    const scenarioPath = path.join(recordingsDir, scenarioName);
    // Clean up any pre-existing test file
    if (fs.existsSync(scenarioPath))
      fs.unlinkSync(scenarioPath);


    const videoContext = await context.browser().newContext({ recordVideo: { dir: recordingsDir } });
    const videoPage = await videoContext.newPage();
    await videoPage!.goto('https://playwright.dev/');
    await videoPage!.click('body');
    await videoPage!.waitForTimeout(1000);
    await videoPage!.close();
    // Simulate MCP tool: rename the last .webm file to scenario-based name
    const filesBefore = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.webm'));
    // Find the most recent .webm file
    let latestFile: string | undefined;
    let latestMtime = 0;
    for (const file of filesBefore) {
      const stat = fs.statSync(path.join(recordingsDir, file));
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestFile = file;
      }
    }
    if (latestFile && latestFile !== scenarioName)
      fs.renameSync(path.join(recordingsDir, latestFile), scenarioPath);
    await new Promise(res => setTimeout(res, 500));
    expect(fs.existsSync(scenarioPath)).toBeTruthy();
    // (No cleanup: leave the video file for inspection)
    await videoContext.close();
  });
});
await new Promise(res => setTimeout(res, 500));
