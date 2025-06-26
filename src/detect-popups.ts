import { Page } from "playwright";

const THRESHOLD = 40;

export const popupAnalysis = (page: Page) => {
  const analysis = {
    isPopup: false,
    confidence: 0,
    reasons: [] as string[],
  };

  // Check window opener
  if (window.opener !== null) {
    analysis.reasons.push("Has window.opener");
    analysis.confidence += 30;
  }

  // Check window dimensions
  const width = window.outerWidth;
  const height = window.outerHeight;

  if (width < 800 || height < 600) {
    analysis.reasons.push(`Small dimensions: ${width}x${height}`);
    analysis.confidence += 25;
  }

  // Check window name (non-empty names often indicate popups)
  if (window.name && window.name !== "") {
    analysis.reasons.push(`Window name: ${window.name}`);
    analysis.confidence += 15;
  }

  // Check if window is positioned away from default (0,0)
  if (window.screenX !== 0 || window.screenY !== 0) {
    analysis.reasons.push(
      `Positioned at: ${window.screenX}, ${window.screenY}`
    );
    analysis.confidence += 10;
  }

  // Check if window has specific features disabled
  const hasScrollbars = window.scrollbars !== undefined;
  const hasMenubar = window.menubar !== undefined;
  const hasToolbar = window.toolbar !== undefined;

  if (!hasScrollbars || !hasMenubar || !hasToolbar) {
    analysis.reasons.push("Some browser features disabled");
    analysis.confidence += 10;
  }

  // Check if window is resizable
  if (!!window.resizeTo) {
    analysis.reasons.push("Window is resizable");
    analysis.confidence += 5;
  }

  // Check URL for popup indicators
  const url = window.location.href;
  if (
    url.includes("popup") ||
    url.includes("modal") ||
    url.includes("window")
  ) {
    analysis.reasons.push("URL contains popup indicators");
    analysis.confidence += 10;
  }

  analysis.isPopup = analysis.confidence >= THRESHOLD;

  return analysis;
};
