import { describe, expect, it } from 'vitest';
import { isChromiumVariant } from '../src/config.js';

describe('isChromiumVariant', () => {
  it('should return true for chromium variants', () => {
    expect(isChromiumVariant('chrome')).toBe(true);
    expect(isChromiumVariant('chrome-beta')).toBe(true);
    expect(isChromiumVariant('chrome-canary')).toBe(true);
    expect(isChromiumVariant('chrome-dev')).toBe(true);
    expect(isChromiumVariant('chromium')).toBe(true);
    expect(isChromiumVariant('msedge')).toBe(true);
    expect(isChromiumVariant('msedge-beta')).toBe(true);
    expect(isChromiumVariant('msedge-canary')).toBe(true);
    expect(isChromiumVariant('msedge-dev')).toBe(true);
  });

  it('should return false for non-chromium browsers', () => {
    expect(isChromiumVariant('firefox')).toBe(false);
    expect(isChromiumVariant('webkit')).toBe(false);
    expect(isChromiumVariant('safari')).toBe(false);
    expect(isChromiumVariant('opera')).toBe(false);
    expect(isChromiumVariant('')).toBe(false);
  });
});
