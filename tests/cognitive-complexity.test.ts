import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type * as actions from '../src/actions.js';
import { isChromiumVariant } from '../src/config.js';
import { SessionLog } from '../src/sessionLog.js';
import type { Tab } from '../src/tab.js';

describe('Cognitive Complexity Fixes', () => {
  describe('config.ts - isChromiumVariant', () => {
    it('should identify chromium variants correctly', () => {
      const chromeVariants = [
        'chrome',
        'chrome-beta',
        'chrome-canary',
        'chrome-dev',
        'chromium',
      ];
      const edgeVariants = [
        'msedge',
        'msedge-beta',
        'msedge-canary',
        'msedge-dev',
      ];
      const nonChromium = ['firefox', 'webkit', 'safari', 'opera'];

      for (const variant of chromeVariants) {
        expect(isChromiumVariant(variant)).toBe(true);
      }

      for (const variant of edgeVariants) {
        expect(isChromiumVariant(variant)).toBe(true);
      }

      for (const browser of nonChromium) {
        expect(isChromiumVariant(browser)).toBe(false);
      }
    });

    it('should handle edge cases', () => {
      expect(isChromiumVariant('')).toBe(false);
      expect(isChromiumVariant('unknown-browser')).toBe(false);
    });
  });

  describe('SessionLog - _createUserActionEntry complexity', () => {
    let sessionLog: SessionLog;
    let mockTab: Tab;
    let mockAction: actions.Action;

    beforeEach(() => {
      // Use test-specific temporary directory with restricted permissions instead of /tmp
      const testTempDir = path.join(process.cwd(), 'tmp', 'test-sessions');
      fs.mkdirSync(testTempDir, { recursive: true, mode: 0o700 }); // Owner-only access
      sessionLog = new SessionLog(path.join(testTempDir, 'test-session'));
      mockTab = {
        page: {
          url: () => 'https://example.com',
        },
      } as Tab;
      mockAction = {
        name: 'navigate',
        url: 'https://example.com',
        ariaSnapshot: 'test snapshot',
      } as actions.Action;
    });

    it('should create user action entry with correct structure', () => {
      const trimmedCode = 'test code';
      const entry = (sessionLog as any)._createUserActionEntry(
        mockAction,
        mockTab,
        trimmedCode
      );

      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('userAction', mockAction);
      expect(entry).toHaveProperty('code', trimmedCode);
      expect(entry).toHaveProperty('tabSnapshot');
      expect(entry.tabSnapshot).toHaveProperty('url', 'https://example.com');
      expect(entry.tabSnapshot).toHaveProperty('ariaSnapshot', 'test snapshot');
    });

    it('should handle different action types', () => {
      const clickAction = {
        name: 'click',
        selector: '#button',
        ariaSnapshot: 'button snapshot',
      } as actions.Action;

      const entry = (sessionLog as any)._createUserActionEntry(
        clickAction,
        mockTab,
        'click code'
      );

      expect(entry.userAction).toEqual(clickAction);
      expect(entry.tabSnapshot.ariaSnapshot).toBe('button snapshot');
    });
  });
});
