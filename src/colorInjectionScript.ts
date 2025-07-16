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

export function generateColorInjectionScript(color: string, agentName: string): string {
  return `
(() => {
    // Add colored border and label
    const style = document.createElement('style');
    style.textContent = \`
    :root {
      --agent-color: ${color};
      --agent-name: "${agentName}";
    }

    body {
      border: 8px solid var(--agent-color) !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    }

    body::after {
      content: var(--agent-name);
      position: fixed;
      top: 10px;
      right: 10px;
      background: var(--agent-color);
      color: white;
      padding: 5px 10px;
      z-index: 999999;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      pointer-events: none;
    }
  \`;

    // Apply immediately
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }

    // Update title
    const originalTitle = document.title;
    const emoji = '🟦'; // Default emoji, could be customized based on color
    document.title = \`\${emoji} \${originalTitle}\`;

    // Monitor title changes
    new MutationObserver(() => {
        if (!document.title.startsWith(emoji)) {
            document.title = \`\${emoji} \${document.title}\`;
        }
    }).observe(document.querySelector('title'), { childList: true });
})();
`;
}

export function normalizeColor(color: string): string {
  // Convert common color names to hex values
  const colorMap: Record<string, string> = {
    'red': '#ff0000',
    'green': '#00ff00',
    'blue': '#0000ff',
    'yellow': '#ffff00',
    'orange': '#ffa500',
    'purple': '#800080',
    'pink': '#ffc0cb',
    'black': '#000000',
    'white': '#ffffff',
    'gray': '#808080',
    'grey': '#808080',
    'cyan': '#00ffff',
    'magenta': '#ff00ff',
  };

  const lowerColor = color.toLowerCase();
  return colorMap[lowerColor] || color;
}

export function getDefaultAgentName(color: string): string {
  // Generate agent name from color
  const colorName = color.toLowerCase();
  const colorNames: Record<string, string> = {
    '#ff0000': 'RED',
    '#00ff00': 'GREEN',
    '#0000ff': 'BLUE',
    '#ffff00': 'YELLOW',
    '#ffa500': 'ORANGE',
    '#800080': 'PURPLE',
    '#ffc0cb': 'PINK',
    '#000000': 'BLACK',
    '#ffffff': 'WHITE',
    '#808080': 'GRAY',
    '#00ffff': 'CYAN',
    '#ff00ff': 'MAGENTA',
  };

  // Check if it's a known hex color
  if (colorNames[color]) {
    return `${colorNames[color]}-AGENT`;
  }

  // Check if it's a named color
  if (colorName.match(/^[a-z]+$/)) {
    return `${colorName.toUpperCase()}-AGENT`;
  }

  // For other formats (rgb, hsl, etc.), use generic name
  return 'COLOR-AGENT';
}