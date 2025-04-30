import path from 'path';
import os from 'os';
import fs from 'fs';

import chalk from 'chalk';
import dotenv from 'dotenv';

import { program } from 'commander';
import { LaunchOptions } from 'playwright';
import { limetest } from './limetest';
import { Context } from '@limetest/core';

dotenv.config();

const readline = require('readline');
const packageJSON = require('../package.json');

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--headless', 'Run browser in headless mode, headed by default')
    .option('--user-data-dir <path>', 'Path to the user data directory')
    .argument('[test]', 'Name of the test to run')
    .action(async (test, options) => {
      const launchOptions: LaunchOptions = {
        headless: !!options.headless,
        channel: 'chrome',
      };
      const userDataDir = options.userDataDir ?? await createUserDataDir();
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
      // const config = await loadConfig();
      // const baseUrl = config.baseUrl;

      let testFiles;
      if (test)
        testFiles = await findTestFiles(test);
      else
        testFiles = await findTestFiles('*');


      await runTests(testFiles, {
        userDataDir,
        launchOptions,
        cdpEndpoint: options.cdpEndpoint,
        apiKey: apiKey,
        baseUrl: options.baseUrl,
      });
    });

program.parse(process.argv);

async function createUserDataDir() {
  let cacheDirectory: string;
  if (process.platform === 'linux')
    cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  else if (process.platform === 'darwin')
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  else if (process.platform === 'win32')
    cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  else
    throw new Error('Unsupported platform: ' + process.platform);
  const result = path.join(cacheDirectory, 'ms-best', 'best-chrome-profile');
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

type Options = {
    userDataDir?: string;
    launchOptions?: LaunchOptions;
    cdpEndpoint?: string;
    apiKey?: string;
    baseUrl?: string;
};

type TestCase = {
    id: number;
    definition: string;
    status: 'pending' | 'running' | 'pass' | 'fail' | 'error';
    line: number;
    errorMessage?: string;
};

async function runTests(testFiles: string[], options: Options) {
  const context = new Context({
    userDataDir: options.userDataDir ?? '',
    launchOptions: options.launchOptions,
    cdpEndpoint: options.cdpEndpoint,
    apiKey: options.apiKey,
  });
  const allTestCases: TestCase[] = [];
  for (const testFile of testFiles) {
    const content = await fs.promises.readFile(testFile, 'utf8');
    const parts = content.split(/\n- /);
    for (const part of parts) {
      if (!part)
        continue;
      const testCase = part.split('\n\n')[0].trim().replace(/^-\s*/, '');
      allTestCases.push({
        id: allTestCases.length + 1,
        definition: testCase,
        status: 'pending',
        line: 0,
      });
    }
  }

  console.log('\n');
  allTestCases.forEach((test, index) => {
    console.log(`${chalk.gray('⋯')} ${test.definition}`);
    test.line = index + 1;
  });

  readline.moveCursor(process.stdout, 0, -allTestCases.length);
  for (const test of allTestCases) {
    updateTestStatus(test, 'running');
    try {
      const result = await limetest.handle(context, { testDefinition: test.definition });
      const responseText = result.content[0].text as string;
      const status = processTestResult(responseText, test);
      updateTestStatus(test, status);
    } catch (error) {
      test.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateTestStatus(test, 'error');
    }
    readline.moveCursor(process.stdout, 0, 1);
  }
  readline.moveCursor(process.stdout, 0, allTestCases.length - allTestCases.length);
  console.log('\n');
  context.close();
}

function updateTestStatus(test: TestCase, status: TestCase['status']) {
  test.status = status;
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);

  let symbol = '';
  let colorFn = chalk.white;

  switch (status) {
    case 'pending':
      symbol = '⋯';
      colorFn = chalk.gray;
      break;
    case 'running':
      symbol = '⟳';
      colorFn = chalk.white;
      break;
    case 'pass':
      symbol = '✓';
      colorFn = chalk.green;
      break;
    case 'fail':
      symbol = '✗';
      colorFn = chalk.red;
      break;
    case 'error':
      symbol = '!';
      colorFn = chalk.yellow;
      break;
  }
  process.stdout.write(`${colorFn(symbol)} ${colorFn(test.definition)}`);
  if (test.errorMessage && (status === 'error' || status === 'fail')) {
    process.stdout.write(`\n    ${colorFn(test.errorMessage)}`);
    readline.moveCursor(process.stdout, 0, -1);
  }
}

function processTestResult(responseText: string, test: TestCase): TestCase['status'] {
  const jsonMatch = responseText.match(/```json\s*(.+?)\s*```/s) || responseText.match(/\s*(.+?)\s*/s);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const resultJson = JSON.parse(jsonMatch[1]);
      const status = resultJson.status;
      test.errorMessage = resultJson.errorMessage;

      return status === 'PASS' ? 'pass' : 'fail';
    } catch (error) {
      test.errorMessage = 'JSON parse error';
      return 'error';
    }
  } else {
    test.errorMessage = 'No JSON found in response';
    return 'error';
  }
}

async function findTestFiles(testName: string) {
  const projectRoot = process.cwd();
  let targetFilename = testName;
  if (!targetFilename.endsWith('.spec.md')) {
    if (targetFilename.endsWith('.spec'))
      targetFilename += '.md';
    else
      targetFilename += '.spec.md';

  }

  const pattern = path.join(projectRoot, '**', targetFilename).replace(/\\/g, '/');
  try {
    // For glob v11+, use the glob.glob method
    const { glob: globFn } = await import('glob');
    const files = await globFn(pattern, { absolute: true });
    if (files.length === 0)
      console.log(chalk.red(`No file named "${targetFilename}" found in project directory.`));

    return files;
  } catch (error) {
    console.error(`Error during search:`, error);
    return [];
  }
}
