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

const { spawnSync } = require('child_process');
const { program } = require('playwright-core/lib/utilsBundle');
const { tools, libCli } = require('playwright-core/lib/coreBundle');

if (process.argv.includes('install-browser')) {
  const argv = process.argv.map(arg => arg === 'install-browser' ? 'install' : arg);
  libCli.decorateProgram(program);
  void program.parseAsync(argv);
  return;
}

// Snapshot pre-existing playwright-core cliDaemon processes so that on exit
// we only clean up daemons that were spawned during this MCP server's
// lifetime. Without this cleanup, the cliDaemon (and its headless browser)
// keeps running after the MCP wrapper exits because it is launched with
// `detached: true` + `child.unref()` (see playwright-core's session.js).
// MCP clients commonly hard-kill the wrapper process on session end (or just
// close stdio), so signal forwarding alone does not survive that path.
const DAEMON_CMDLINE_PATTERN = /\bnode\b.*\/cliDaemon\.js\b/;

function snapshotDaemonPids() {
  if (process.platform === 'win32')
    return new Set();
  try {
    const result = spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    if (result.status !== 0 || !result.stdout)
      return new Set();
    const pids = new Set();
    for (const line of result.stdout.split('\n')) {
      if (!DAEMON_CMDLINE_PATTERN.test(line))
        continue;
      const match = line.match(/^\s*(\d+)\b/);
      if (match)
        pids.add(parseInt(match[1], 10));
    }
    return pids;
  } catch {
    return new Set();
  }
}

const initialDaemonPids = snapshotDaemonPids();
let cleanupHasRun = false;

function cleanupSpawnedDaemons({ blocking } = { blocking: false }) {
  if (cleanupHasRun)
    return;
  cleanupHasRun = true;
  const current = snapshotDaemonPids();
  const ours = [];
  for (const pid of current) {
    if (!initialDaemonPids.has(pid))
      ours.push(pid);
  }
  if (!ours.length)
    return;
  for (const pid of ours) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  if (!blocking)
    return;
  // Give children up to ~500ms to die gracefully before SIGKILL.
  const deadline = Date.now() + 500;
  while (Date.now() < deadline) {
    let anyAlive = false;
    for (const pid of ours) {
      try { process.kill(pid, 0); anyAlive = true; break; } catch { /* dead */ }
    }
    if (!anyAlive)
      return;
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)']); // ~50ms sleep
  }
  for (const pid of ours) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* dead */ }
  }
}

function gracefulShutdown(signal) {
  cleanupSpawnedDaemons({ blocking: true });
  // Re-raise the signal with default handler so exit code reflects the signal.
  process.exit(signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 0);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(signal, () => gracefulShutdown(signal));

// 'exit' fires synchronously; only sync work allowed.
process.on('exit', () => cleanupSpawnedDaemons({ blocking: false }));

// MCP stdio transport: when the parent (e.g. an LLM client) closes stdin,
// our process should treat that as a disconnect and shut down cleanly.
// Without this, the wrapper can linger after the parent exits, and so can
// any cliDaemon it spawned.
//
// HTTP mode (`--port`/`--host`) does not use stdin for transport; in that
// mode the listener would fire spuriously when stdin is closed at startup,
// so we only attach it in stdio mode.
const isHttpMode = process.argv.some(a => a === '--port' || a.startsWith('--port=')
    || a === '--host' || a.startsWith('--host='));
if (!isHttpMode && process.stdin && !process.stdin.isTTY) {
  process.stdin.once('end', () => gracefulShutdown('SIGTERM'));
  process.stdin.once('close', () => gracefulShutdown('SIGTERM'));
}

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
tools.decorateMCPCommand(p, packageJSON.version);

void program.parseAsync(process.argv);
