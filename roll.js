const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyConfig() {
  const src = path.join(__dirname, '..', 'playwright', 'packages', 'playwright-core', 'src', 'tools', 'mcp', 'config.d.ts');
  const dst = path.join(__dirname, 'config.d.ts');
  let content = fs.readFileSync(src, 'utf-8');
  content = content.replace(
    /^import type \* as playwright from '[^']+';$/m,
    "import type * as playwright from 'playwright';"
  );
  fs.writeFileSync(dst, content);
  console.log(`Copied config.d.ts from ${src} to ${dst}`);
}

function updatePlaywrightVersion(version) {
  const file = path.join(__dirname, 'package.json');
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

  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
}

// Sets NODE_VERSION in the Dockerfile to the latest Node.js release of the same major version.
async function updateNodeVersion() {
  const file = path.join(__dirname, 'Dockerfile');
  const content = fs.readFileSync(file, 'utf-8');
  const match = content.match(/^ARG NODE_VERSION=((\d+)\.\d+\.\d+)$/m);
  if (!match)
    throw new Error(`No exact NODE_VERSION in ${file}`);
  const [line, oldVersion, major] = match;
  const response = await fetch('https://nodejs.org/dist/index.json');
  if (!response.ok)
    throw new Error(`Failed to get the Node.js release index: ${response.status}`);
  // The index is ordered newest-first.
  const release = (await response.json()).find(r => r.version.startsWith(`v${major}.`));
  if (!release)
    throw new Error(`No Node.js ${major} release in the Node.js release index`);
  const newVersion = release.version.slice(1);
  fs.writeFileSync(file, content.replace(line, `ARG NODE_VERSION=${newVersion}`));
  console.log(`Node.js in ${file}: ${oldVersion} -> ${newVersion}`);
}

async function doRoll(version) {
  await updateNodeVersion();
  updatePlaywrightVersion(version);
  copyConfig();
  // update readme
  execSync('npm run lint', { cwd: __dirname, stdio: 'inherit' });
}

async function main() {
  let version = process.argv[2];
  // Updates only the Node.js version of the Docker image.
  if (version === '--node') {
    await updateNodeVersion();
    return;
  }
  if (!version) {
    version = execSync('npm info playwright@next version', { encoding: 'utf-8' }).trim();
    console.log(`Using next playwright version: ${version}`);
  }
  await doRoll(version);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
