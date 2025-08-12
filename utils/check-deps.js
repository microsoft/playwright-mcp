#!/usr/bin/env node
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

import fs from 'fs';
import ts from 'typescript';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const depsCache = {};
const packageRoot = path.resolve(__dirname, '..');

async function checkDeps() {
  const deps = new Set();
  const src = path.join(packageRoot, 'src');

  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true,
    },
    rootNames: listAllFiles(src),
  });
  const sourceFiles = program.getSourceFiles();
  const errors = [];
  sourceFiles.filter(x => !x.fileName.includes(path.sep + 'node_modules' + path.sep) && !x.fileName.includes(path.sep + 'bundles' + path.sep)).map(x => visit(x, x.fileName, x.getFullText()));

  if (errors.length) {
    for (const error of errors)
      console.log(error);
    console.log(`--------------------------------------------------------`);
    console.log(`Changing the project structure or adding new components?`);
    console.log(`Update DEPS in ${packageRoot}`);
    console.log(`--------------------------------------------------------`);
    process.exit(1);
  }

  function visit(node, fileName, text) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.importClause) {
        if (node.importClause.isTypeOnly)
          return;
        if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          if (node.importClause.namedBindings.elements.every(e => e.isTypeOnly))
            return;
        }
      }
      const importName = node.moduleSpecifier.text;
      let importPath;
      if (importName.startsWith('.'))
        importPath = path.resolve(path.dirname(fileName), importName);

      const mergedDeps = calculateDeps(fileName);
      if (mergedDeps.includes('***'))
        return;
      if (importPath) {
        if (!fs.existsSync(importPath)) {
          if (fs.existsSync(importPath + '.ts'))
            importPath = importPath + '.ts';
          else if (fs.existsSync(importPath + '.tsx'))
            importPath = importPath + '.tsx';
          else if (fs.existsSync(importPath + '.d.ts'))
            importPath = importPath + '.d.ts';
        }

        if (!allowImport(fileName, importPath, mergedDeps))
          errors.push(`Disallowed import ${path.relative(packageRoot, importPath)} in ${path.relative(packageRoot, fileName)}`);
        return;
      }

      const fullStart = node.getFullStart();
      const commentRanges = ts.getLeadingCommentRanges(text, fullStart);
      for (const range of commentRanges || []) {
          const comment = text.substring(range.pos, range.end);
          if (comment.includes('@no-check-deps'))
            return;
      }

      if (importName.startsWith('@'))
        deps.add(importName.split('/').slice(0, 2).join('/'));
      else
        deps.add(importName.split('/')[0]);
    }
    ts.forEachChild(node, x => visit(x, fileName, text));
  }

  function calculateDeps(from) {
    const fromDirectory = path.dirname(from);
    let depsDirectory = fromDirectory;
    while (depsDirectory.startsWith(packageRoot) && !depsCache[depsDirectory] && !fs.existsSync(path.join(depsDirectory, 'DEPS.list')))
      depsDirectory = path.dirname(depsDirectory);
    if (!depsDirectory.startsWith(packageRoot))
      return [];

    let deps = depsCache[depsDirectory];
    if (!deps) {
      const depsListFile = path.join(depsDirectory, 'DEPS.list');
      deps = {};
      let group = [];
      for (const line of fs.readFileSync(depsListFile, 'utf-8').split('\n').filter(Boolean).filter(l => !l.startsWith('#'))) {
        const groupMatch = line.match(/\[(.*)\]/);
        if (groupMatch) {
          group = [];
          deps[groupMatch[1]] = group;
          continue;
        }
        if (line === '***')
          group.push('***');
        else
          group.push(path.resolve(depsDirectory, line));
      }
      depsCache[depsDirectory] = deps;
    }

    return [...(deps['*'] || []), ...(deps[path.relative(depsDirectory, from)] || [])]
  }

  function allowImport(from, to, mergedDeps) {
    const fromDirectory = path.dirname(from);
    const toDirectory = isDirectory(to) ? to : path.dirname(to);
    if (to === toDirectory)
      to = path.join(to, 'index.ts');
    if (fromDirectory === toDirectory)
      return true;

    for (const dep of mergedDeps) {
      if (dep === '***')
        return true;
      if (to === dep || toDirectory === dep)
        return true;
      if (dep.endsWith('**')) {
        const parent = dep.substring(0, dep.length - 2);
        if (to.startsWith(parent))
          return true;
      }
    }
    return false;
  }
}

function listAllFiles(dir) {
  const dirs = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  dirs.forEach(d => {
    const res = path.resolve(dir, d.name);
    if (d.isDirectory())
      result.push(...listAllFiles(res));
    else
      result.push(res);
  });
  return result;
}

checkDeps().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});

function isDirectory(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}
