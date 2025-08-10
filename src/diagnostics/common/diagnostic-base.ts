/**
 * Base class for diagnostic components providing common initialization and cleanup patterns
 */

import type * as playwright from 'playwright';

export interface IDisposable {
  dispose(): Promise<void>;
}

export abstract class DiagnosticBase implements IDisposable {
  private isDisposed = false;
  protected readonly componentName: string;
  protected readonly page: playwright.Page | null;

  constructor(page: playwright.Page | null, componentName: string) {
    this.page = page;
    this.componentName = componentName;
  }

  /**
   * Check if the component has been disposed
   * @throws Error if component is disposed
   */
  protected checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error(`${this.componentName} has been disposed`);
    }
  }

  /**
   * Get validated page reference
   * @returns Valid playwright.Page instance
   * @throws Error if page is null or component is disposed
   */
  protected getPage(): playwright.Page {
    this.checkDisposed();
    if (!this.page) {
      throw new Error('Page reference is null');
    }
    return this.page;
  }

  /**
   * Check if component is disposed
   */
  getIsDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Check if component is disposed (protected access for subclasses)
   */
  protected get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Mark component as disposed
   */
  protected markDisposed(): void {
    this.isDisposed = true;
  }

  /**
   * Template method for component-specific disposal logic
   */
  protected abstract performDispose(): Promise<void>;

  /**
   * Common disposal implementation
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    try {
      await this.performDispose();
    } catch (_error) {
      // Silently ignore disposal errors
    } finally {
      this.markDisposed();
    }
  }
}
