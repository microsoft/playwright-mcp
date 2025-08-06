/**
 * Page analysis for diagnostic information
 */

import type * as playwright from 'playwright';

export interface PageStructureAnalysis {
  iframes: {
    detected: boolean;
    count: number;
    accessible: Array<{ src: string; accessible: boolean }>;
    inaccessible: Array<{ src: string; reason: string }>;
  };
  modalStates: {
    hasDialog: boolean;
    hasFileChooser: boolean;
    blockedBy: string[];
  };
  elements: {
    totalVisible: number;
    totalInteractable: number;
    missingAria: number;
  };
}

export class PageAnalyzer {
  constructor(private page: playwright.Page) {}

  async analyzePageStructure(): Promise<PageStructureAnalysis> {
    const [iframes, modalStates, elements] = await Promise.all([
      this.analyzeIframes(),
      this.analyzeModalStates(),
      this.analyzeElements()
    ]);

    return {
      iframes,
      modalStates,
      elements
    };
  }

  private async analyzeIframes() {
    const iframes = await this.page.$$('iframe');
    const detected = iframes.length > 0;
    const accessible: Array<{ src: string; accessible: boolean }> = [];
    const inaccessible: Array<{ src: string; reason: string }> = [];

    for (const iframe of iframes) {
      const src = await iframe.getAttribute('src') || 'about:blank';
      
      try {
        // Try to access the iframe's content
        const frame = await iframe.contentFrame();
        if (frame) {
          try {
            // Try to access frame content with timeout to verify it's truly accessible
            await Promise.race([
              frame.url(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
            ]);
            accessible.push({ src, accessible: true });
          } catch (frameError) {
            inaccessible.push({ 
              src, 
              reason: 'Frame content not accessible - cross-origin or blocked'
            });
          }
        } else {
          inaccessible.push({ 
            src, 
            reason: 'Content frame not available'
          });
        }
      } catch (error) {
        inaccessible.push({ 
          src, 
          reason: error instanceof Error ? error.message : 'Access denied'
        });
      }
    }

    return {
      detected,
      count: iframes.length,
      accessible,
      inaccessible
    };
  }

  private async analyzeModalStates() {
    const blockedBy: string[] = [];
    let hasDialog = false;
    let hasFileChooser = false;

    try {
      // Check for active dialogs by evaluating page state
      hasDialog = await this.page.evaluate(() => {
        // Check for common modal indicators
        const modals = document.querySelectorAll('[role="dialog"], .modal, .dialog, .popup');
        const overlays = document.querySelectorAll('.overlay, .modal-backdrop, .dialog-backdrop');
        return modals.length > 0 || overlays.length > 0;
      });

      // Check for file choosers by looking for file inputs that are being interacted with
      hasFileChooser = await this.page.evaluate(() => {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        return Array.from(fileInputs).some(input => {
          const style = window.getComputedStyle(input);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
      });

    } catch (error) {
      // If evaluation fails, assume no modals (page might not be ready)
      hasDialog = false;
      hasFileChooser = false;
    }

    if (hasDialog) blockedBy.push('dialog');
    if (hasFileChooser) blockedBy.push('fileChooser');

    return {
      hasDialog,
      hasFileChooser,
      blockedBy
    };
  }

  private async analyzeElements() {
    const elementStats = await this.page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let totalVisible = 0;
      let totalInteractable = 0;
      let missingAria = 0;

      for (const element of allElements) {
        const style = window.getComputedStyle(element);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
        
        if (isVisible) {
          totalVisible++;
          
          // Check if element is interactable
          const tagName = element.tagName.toLowerCase();
          const isInteractable = ['button', 'input', 'select', 'textarea', 'a'].includes(tagName) ||
                                 element.hasAttribute('onclick') ||
                                 element.hasAttribute('role');
          
          if (isInteractable) {
            totalInteractable++;
            
            // Check for missing ARIA attributes
            if (!element.hasAttribute('aria-label') && 
                !element.hasAttribute('aria-labelledby') && 
                !element.textContent?.trim()) {
              missingAria++;
            }
          }
        }
      }

      return { totalVisible, totalInteractable, missingAria };
    });

    return elementStats;
  }
}