#!/usr/bin/env node
// @ts-check

const fs = require('node:fs/promises');
const path = require('node:path');

const commonTools = require('./lib/tools/common');
const consoleTools = require('./lib/tools/console');
const dialogsTools = require('./lib/tools/dialogs');
const filesTools = require('./lib/tools/files');
const installTools = require('./lib/tools/install');
const keyboardTools = require('./lib/tools/keyboard');
const navigateTools = require('./lib/tools/navigate');
const pdfTools = require('./lib/tools/pdf');
const snapshotTools = require('./lib/tools/snapshot');
const tabsTools = require('./lib/tools/tabs');
const screenTools = require('./lib/tools/screen');

// Category definitions for tools
const categories = {
  'Snapshot-based Interactions': [
    ...snapshotTools.default,
  ],
  'Vision-based Interactions': [
    ...screenTools.default
  ],
  'Tab Management': [
   ...tabsTools.default(true),
  ],
  'Navigation': [
    ...navigateTools.default(true),
  ],
  'Keyboard': [
    ...keyboardTools.default(true)
  ],
  'Console': [
    ...consoleTools.default
  ],
  'Files and Media': [
    ...filesTools.default(true),
    ...pdfTools.default
  ],
  'Utilities': [
    ...commonTools.default(true),
    ...installTools.default,
    ...dialogsTools.default(true),
  ],
};

/**
 * Format tool information for README display
 * @param {Object} tool - Tool information
 * @returns {string} - Formatted markdown string
 */
function formatToolForReadme(tool) {
  let markdown = `- **${tool.name}**\n`;
  markdown += `  - Description: ${tool.description}\n`;
  
  if (tool.parameters && tool.parameters.length > 0) {
    markdown += `  - Parameters:\n`;
    tool.parameters.forEach(param => {
      const meta = [];
      if (param.type) meta.push(param.type);
      if (param.optional) meta.push('optional');
      
      markdown += `    - \`${param.name}\` ${meta.length ? `(${meta.join(', ')})` : ''}: ${param.description}\n`;
    });
  } else {
    markdown += `  - Parameters: None\n`;
  }
  
  markdown += '\n';
  return markdown;
}

/**
 * Extract tool information from the schema
 * @param {Object} schema - Tool schema
 * @returns {Object} - Processed tool information
 */
function processToolSchema(schema) {
  // Extract the input schema properties
  const inputSchema = schema.inputSchema?.properties || {};
  
  // In JSON Schema, properties are considered optional unless listed in the required array
  const requiredParams = schema.inputSchema?.required || [];
  
  const parameters = Object.entries(inputSchema).map(([name, prop]) => {
    return {
      name,
      description: prop.description || '',
      optional: !requiredParams.includes(name),
      type: prop.type,
    };
  });

  return {
    name: schema.name,
    description: schema.description,
    parameters
  };
}

/**
 * Main function to update README
 */
async function updateReadme() {
  console.log('Loading tool information from compiled modules...');
  
  // Read the README file
  const readmePath = path.join(__dirname, 'README.md');
  
  // Generate new content for each category
  let newReadmeContent = await fs.readFile(readmePath, 'utf-8');
  
  for (const [category, categoryTools] of Object.entries(categories)) {
    if (categoryTools.length === 0) continue;
    
    const sectionHeader = `### ${category}`;
    const startMarker = newReadmeContent.indexOf(sectionHeader);
    
    // If section exists
    if (startMarker !== -1) {
      const nextSectionMarker = newReadmeContent.indexOf('###', startMarker + sectionHeader.length);
      const endMarker = nextSectionMarker !== -1 ? nextSectionMarker : newReadmeContent.length;
      
      // Format new section content
      let newSection = `${sectionHeader}\n\n`;
      for (const tool of categoryTools) {
        const scheme = processToolSchema(tool.schema);
        newSection += formatToolForReadme(scheme);
      }
      
      // Replace section in README
      newReadmeContent = newReadmeContent.substring(0, startMarker) + 
                      newSection + 
                      newReadmeContent.substring(endMarker);
    } else {
      console.warn(`Section for category "${category}" not found in README`);
    }
  }
  
  // Count the tools processed
  const totalTools = Object.values(categories).flat().length;
  console.log(`Found ${totalTools} tools`);
  
  // Write updated README
  await fs.writeFile(readmePath, newReadmeContent, 'utf-8');
  console.log('README updated successfully');
}

// Run the update
updateReadme().catch(err => {
  console.error('Error updating README:', err);
  process.exit(1);
});