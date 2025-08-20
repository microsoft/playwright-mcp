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

import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { argv } from 'process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const readJSON = async (filePath) => JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
const writeJSON = async (filePath, json) => {
  await fs.promises.writeFile(filePath, JSON.stringify(json, null, 2) + '\n');
}

async function updatePackageJSON(dir, version) {
  const packageJSONPath = path.join(dir, 'package.json');
  const packageJSON = await readJSON(packageJSONPath);
  console.log(`Updating ${packageJSONPath} to version ${version}`);
  packageJSON.version = version;
  await writeJSON(packageJSONPath, packageJSON);

  // Run npm i to update package-lock.json
  child_process.execSync('npm i', {
    cwd: dir
  });
}

async function updateExtensionManifest(dir, version) {
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = await readJSON(manifestPath);
  console.log(`Updating ${manifestPath} to version ${version}`);
  manifest.version = version;
  await writeJSON(manifestPath, manifest);
}

async function setVersion(version) {
  if (version.startsWith('v'))
    throw new Error('version must not start with "v"');

  const packageRoot = path.join(__dirname, '..');
  await updatePackageJSON(packageRoot, version)
  await updatePackageJSON(path.join(packageRoot, 'extension'), version)
  await updateExtensionManifest(path.join(packageRoot, 'extension'), version)
}

if (argv.length !== 3) {
  console.error('Usage: set-version <version>');
  process.exit(1);
}

setVersion(argv[2]);