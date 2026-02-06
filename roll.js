const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyConfig() {
  const src = path.join(__dirname, '..', 'playwright', 'packages', 'playwright', 'src', 'mcp', 'config.d.ts');
  const dst = path.join(__dirname, 'packages', 'playwright-mcp', 'config.d.ts');
  let content = fs.readFileSync(src, 'utf-8');
  content = content.replace(
    "import type * as playwright from 'playwright-core';",
    "import type * as playwright from 'playwright';"
  );
  fs.writeFileSync(dst, content);
  console.log(`Copied config.d.ts from ${src} to ${dst}`);
}

function updatePlaywrightVersion(version) {
  const files = [
    path.join(__dirname, 'package.json'),
    path.join(__dirname, 'packages', 'playwright-mcp', 'package.json'),
    path.join(__dirname, 'packages', 'playwright-cli', 'package.json'),
  ];

  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    let updated = false;
    for (const section of ['dependencies', 'devDependencies']) {
      for (const pkg of ['@playwright/test', 'playwright', 'playwright-core']) {
        if (json[section]?.[pkg]) {
          json[section][pkg] = version;
          updated = true;
        }
      }
    }
    if (updated) {
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
      console.log(`Updated ${file}`);
    }
  }

  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
}

function doRoll(version) {
  updatePlaywrightVersion(version);
  copyConfig();
  // update readme
  execSync('npm run lint', { cwd: __dirname, stdio: 'inherit' });
}

let version = process.argv[2];
if (!version) {
  version = execSync('npm info playwright@next version', { encoding: 'utf-8' }).trim();
  console.log(`Using next playwright version: ${version}`);
}
doRoll(version);
