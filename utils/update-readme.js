#!/usr/bin/env node

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
// @ts-check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zodToJsonSchema from 'zod-to-json-schema';

import { allTools } from '../lib/tools.js';

const capabilities = {
  core: 'Core automation',
  'core-tabs': 'Tab management',
  'core-install': 'Browser installation',
  vision: 'Coordinate-based (opt-in via --caps=vision)',
  pdf: 'PDF generation (opt-in via --caps=pdf)',
};

const toolsByCapability = Object.fromEntries(
  Object.entries(capabilities).map(([capability, title]) => [
    title,
    allTools
      .filter((tool) => tool.capability === capability)
      .sort((a, b) => a.schema.name.localeCompare(b.schema.name)),
  ])
);

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

/**
 * @param {string} name
 * @param {any} param
 * @param {string[]} requiredParams
 * @returns {string}
 */
function formatParameter(name, param, requiredParams) {
  const optional = !requiredParams.includes(name);
  const meta = /** @type {string[]} */ ([]);
  if (param.type) {
    meta.push(param.type);
  }
  if (optional) {
    meta.push('optional');
  }
  const metaInfo = meta.length > 0 ? `(${meta.join(', ')})` : '';
  return `    - \`${name}\` ${metaInfo}: ${param.description}`;
}

/**
 * @param {any} inputSchema
 * @returns {string[]}
 */
function formatParameters(inputSchema) {
  const lines = /** @type {string[]} */ ([]);
  const requiredParams = inputSchema.required || [];

  if (inputSchema.properties && Object.keys(inputSchema.properties).length) {
    lines.push('  - Parameters:');
    for (const [name, param] of Object.entries(inputSchema.properties)) {
      lines.push(formatParameter(name, param, requiredParams));
    }
  } else {
    lines.push('  - Parameters: None');
  }
  return lines;
}

/**
 * @param {import('../src/tools/tool.js').ToolSchema<any>} tool
 * @returns {string[]}
 */
function formatToolForReadme(tool) {
  const lines = /** @type {string[]} */ ([]);
  lines.push(
    `<!-- NOTE: This has been generated via ${path.basename(__filename)} -->`
  );
  lines.push('');
  lines.push(`- **${tool.name}**`);
  lines.push(`  - Title: ${tool.title}`);
  lines.push(`  - Description: ${tool.description}`);

  const inputSchema = /** @type {any} */ (
    zodToJsonSchema(tool.inputSchema || {})
  );

  lines.push(...formatParameters(inputSchema));
  lines.push(`  - Read-only: **${tool.type === 'readOnly'}**`);
  lines.push('');
  return lines;
}

/**
 * @param {string} content
 * @param {string} startMarker
 * @param {string} endMarker
 * @param {string[]} generatedLines
 * @returns {string}
 */
function updateSection(content, startMarker, endMarker, generatedLines) {
  const startMarkerIndex = content.indexOf(startMarker);
  const endMarkerIndex = content.indexOf(endMarker);
  if (startMarkerIndex === -1 || endMarkerIndex === -1) {
    throw new Error('Markers for generated section not found in README');
  }

  // Sanitize generated content to prevent injection attacks
  const sanitizedContent = generatedLines
    .filter((line) => typeof line === 'string')
    .map((line) => line.replace(/[\r\n]/g, ''))
    .join('\n');

  return [
    content.slice(0, startMarkerIndex + startMarker.length),
    '',
    sanitizedContent,
    '',
    content.slice(endMarkerIndex),
  ].join('\n');
}

/**
 * @param {string} content
 * @returns {string}
 */
function updateTools(content) {
  const generatedLines = /** @type {string[]} */ ([]);
  for (const [capability, tools] of Object.entries(toolsByCapability)) {
    const escapedCapability = capability.replace(/[<>&"']/g, (char) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[char] || char;
    });
    generatedLines.push(
      `<details>\n<summary><b>${escapedCapability}</b></summary>`
    );
    generatedLines.push('');
    for (const tool of tools) {
      generatedLines.push(...formatToolForReadme(tool.schema));
    }
    generatedLines.push('</details>');
    generatedLines.push('');
  }

  const filename = path.basename(__filename).replace(/[<>&"']/g, (char) => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
  const startMarker = `<!--- Tools generated by ${filename} -->`;
  const endMarker = '<!--- End of tools generated section -->';
  return updateSection(content, startMarker, endMarker, generatedLines);
}

/**
 * @param {string} content
 * @returns {string}
 */
function updateOptions(content) {
  const currentDir = path.dirname(__filename);
  const cliPath = path.resolve(currentDir, '..', 'cli.js');

  // Validate CLI file exists and is in expected location for security
  if (!fs.existsSync(cliPath)) {
    throw new Error('CLI file not found at expected location');
  }

  // Execute CLI help command with explicit path and safe arguments
  // Using spawnSync with controlled environment to prevent injection attacks
  const result = spawnSync('node', [resolvedCliPath, argToUse], {
    cwd: currentDir,
    shell: false, // Explicitly disable shell to prevent command injection
    // Explicitly set safe environment to prevent PATH injection
    env: {
      NODE_ENV: 'production',
      PATH: '/usr/bin:/bin:/usr/local/bin',
    },
    // Additional security options
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000, // 10 second timeout to prevent hanging
  });

  if (result.error) {
    throw new Error(`Failed to execute command: ${result.error.message}`);
  }

  const output = result.stdout;
  const lines = output.toString().split('\n');
  const firstLine = lines.findIndex((line) => line.includes('--version'));
  lines.splice(0, firstLine + 1);
  const lastLine = lines.findIndex((line) => line.includes('--help'));
  lines.splice(lastLine);
  const startMarker = `<!--- Options generated by ${path.basename(__filename)} -->`;
  const endMarker = '<!--- End of options generated section -->';
  return updateSection(content, startMarker, endMarker, [
    '```',
    '> npx @tontoko/fast-playwright-mcp@latest --help',
    ...lines,
    '```',
  ]);
}

async function updateReadme() {
  const readmePath = path.join(path.dirname(__filename), '..', 'README.md');
  const readmeContent = await fs.promises.readFile(readmePath, 'utf-8');
  const withTools = updateTools(readmeContent);
  const withOptions = updateOptions(withTools);
  await fs.promises.writeFile(readmePath, withOptions, 'utf-8');
}

updateReadme().catch((_err) => {
  process.exit(1);
});
