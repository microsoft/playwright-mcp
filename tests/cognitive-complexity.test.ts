import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tab, TabSnapshot } from '../src/tab.js';
import type * as actions from '../src/actions.js';
import { SessionLog } from '../src/sessionLog.js';
import { isChromiumVariant } from '../src/config.js';

describe('Cognitive Complexity Fixes', () => {
  describe('config.ts - isChromiumVariant', () => {
    it('should identify chromium variants correctly', () => {
      const chromeVariants = [
        'chrome', 'chrome-beta', 'chrome-canary', 'chrome-dev', 'chromium'
      ];
      const edgeVariants = [
        'msedge', 'msedge-beta', 'msedge-canary', 'msedge-dev'
      ];
      const nonChromium = ['firefox', 'webkit', 'safari', 'opera'];

      chromeVariants.forEach(variant => {
        expect(isChromiumVariant(variant)).toBe(true);
      });

      edgeVariants.forEach(variant => {
        expect(isChromiumVariant(variant)).toBe(true);
      });

      nonChromium.forEach(browser => {
        expect(isChromiumVariant(browser)).toBe(false);
      });
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
      sessionLog = new SessionLog('/tmp/test-session');
      mockTab = {
        page: {
          url: () => 'https://example.com'
        }
      } as Tab;
      mockAction = {
        name: 'navigate',
        url: 'https://example.com',
        ariaSnapshot: 'test snapshot'
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
        ariaSnapshot: 'button snapshot'
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