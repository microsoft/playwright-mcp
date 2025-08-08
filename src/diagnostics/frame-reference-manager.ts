import type * as playwright from 'playwright';
import type { IDisposable } from './resource-manager.js';

export interface FrameMetadata {
  url: string;
  name: string | null;
  parentFrame: playwright.Frame | null;
  isDetached: boolean;
  timestamp: number;
  elementCount?: number;
}

/**
 * Manages Frame references and their lifecycle for iframe analysis
 * Prevents memory leaks and provides proper cleanup for detached frames
 */
export class FrameReferenceManager implements IDisposable {
  private readonly frameRefs = new WeakMap<playwright.Frame, FrameMetadata>();
  private readonly activeFrames = new Set<playwright.Frame>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Track a frame and store its metadata
   */
  trackFrame(frame: playwright.Frame): void {
    if (this.disposed) {
      throw new Error('FrameReferenceManager has been disposed');
    }

    try {
      const metadata: FrameMetadata = {
        url: frame.url() || 'about:blank',
        name: frame.name() || null,
        parentFrame: frame.parentFrame(),
        isDetached: false,
        timestamp: Date.now(),
      };

      this.frameRefs.set(frame, metadata);
      this.activeFrames.add(frame);
    } catch (_error) {
      // Frame might be detached already, skip tracking
    }
  }

  /**
   * Untrack a frame when it's no longer needed
   */
  untrackFrame(frame: playwright.Frame): void {
    this.activeFrames.delete(frame);
    // Note: WeakMap entries will be garbage collected automatically
  }

  /**
   * Get metadata for a tracked frame
   */
  getFrameMetadata(frame: playwright.Frame): FrameMetadata | undefined {
    return this.frameRefs.get(frame);
  }

  /**
   * Get all currently active frames
   */
  getActiveFrames(): playwright.Frame[] {
    return Array.from(this.activeFrames);
  }

  /**
   * Update element count for a frame (for performance tracking)
   */
  updateElementCount(frame: playwright.Frame, count: number): void {
    const metadata = this.frameRefs.get(frame);
    if (metadata) {
      metadata.elementCount = count;
    }
  }

  /**
   * Clean up detached frames that are no longer accessible
   */
  async cleanupDetachedFrames(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const framesToRemove: playwright.Frame[] = [];

    for (const frame of this.activeFrames) {
      try {
        // Try to access frame properties to check if it's still attached
        await Promise.race([
          frame.url(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 1000)
          ),
        ]);
      } catch (_error) {
        // Frame is likely detached
        const metadata = this.frameRefs.get(frame);
        if (metadata) {
          metadata.isDetached = true;
        }

        framesToRemove.push(frame);
      }
    }

    // Remove detached frames from active tracking
    for (const frame of framesToRemove) {
      this.activeFrames.delete(frame);
    }

    // Cleaned up detached frames
  }

  /**
   * Get statistics about tracked frames
   */
  getStatistics(): {
    activeCount: number;
    totalTracked: number;
    detachedCount: number;
    averageElementCount: number;
  } {
    let detachedCount = 0;
    let totalElements = 0;
    let framesWithElementCount = 0;

    for (const frame of this.activeFrames) {
      const metadata = this.frameRefs.get(frame);
      if (metadata) {
        if (metadata.isDetached) {
          detachedCount++;
        }

        if (typeof metadata.elementCount === 'number') {
          totalElements += metadata.elementCount;
          framesWithElementCount++;
        }
      }
    }

    const averageElementCount =
      framesWithElementCount > 0 ? totalElements / framesWithElementCount : 0;

    return {
      activeCount: this.activeFrames.size,
      totalTracked: this.activeFrames.size, // In our case, same as active
      detachedCount,
      averageElementCount: Math.round(averageElementCount),
    };
  }

  /**
   * Find frames that exceed performance thresholds
   */
  findPerformanceIssues(): {
    largeFrames: Array<{
      frame: playwright.Frame;
      elementCount: number;
      url: string;
    }>;
    oldFrames: Array<{ frame: playwright.Frame; age: number; url: string }>;
  } {
    const now = Date.now();
    const largeFrames: Array<{
      frame: playwright.Frame;
      elementCount: number;
      url: string;
    }> = [];
    const oldFrames: Array<{
      frame: playwright.Frame;
      age: number;
      url: string;
    }> = [];

    for (const frame of this.activeFrames) {
      const metadata = this.frameRefs.get(frame);
      if (metadata && !metadata.isDetached) {
        // Check for frames with too many elements
        if (
          typeof metadata.elementCount === 'number' &&
          metadata.elementCount > 1000
        ) {
          largeFrames.push({
            frame,
            elementCount: metadata.elementCount,
            url: metadata.url,
          });
        }

        // Check for frames that have been around too long
        const age = now - metadata.timestamp;
        if (age > 300_000) {
          // 5 minutes
          oldFrames.push({
            frame,
            age,
            url: metadata.url,
          });
        }
      }
    }

    return { largeFrames, oldFrames };
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupDetachedFrames().catch((_error) => {
        // Cleanup timer failed - continue with next cycle
      });
    }, 30_000); // Clean up every 30 seconds
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.cleanupDetachedFrames();
    this.activeFrames.clear();
    this.disposed = true;
  }
}
