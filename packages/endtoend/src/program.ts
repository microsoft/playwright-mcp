import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';

import { program } from 'commander';
import { LaunchOptions } from 'playwright';
import { endtoend } from './endtoend';
import { Context } from '@best/core';

dotenv.config();

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
        if (test) {
            testFiles = await findTestFiles(test);
        } else {
            testFiles = await findTestFiles('*');
        }

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

async function runTests(testFiles: string[], options: Options) {
    const context = new Context({
        userDataDir: options.userDataDir ?? '',
        launchOptions: options.launchOptions,
        cdpEndpoint: options.cdpEndpoint,
        apiKey: options.apiKey,
    });

    for (const testFile of testFiles) {
        console.log(`Running test file: ${testFile}`);
        const content = await fs.promises.readFile(testFile, 'utf8');
        const parts = content.split(/\n- /);
        for (const part of parts) {
            if (!part) continue;
            const testCase = part.split('\n\n')[0].trim();
            console.log(`Test definition: ${testCase.toString()}`);
            const result = await endtoend.handle(context, { testDefinition: testCase });
            console.log(`Result: ${result}`);
        }
    }
}

async function findTestFiles(testName: string) {
    const projectRoot = process.cwd();
    
    let targetFilename = testName;
    if (!targetFilename.endsWith('.spec.md')) {
      if (targetFilename.endsWith('.spec')) {
        targetFilename += '.md';
      } else {
        targetFilename += '.spec.md';
      }
    }
    
    const pattern = path.join(projectRoot, '**', targetFilename).replace(/\\/g, '/');
    console.log(`Searching for: ${targetFilename} using pattern: ${pattern}`);
    
    try {
      // For glob v11+, use the glob.glob method
      const { glob: globFn } = await import('glob');
      const files = await globFn(pattern, { absolute: true });
      
      if (files.length === 0) {
        console.log(`No file named "${targetFilename}" found in project directory.`);
      }
      
      return files;
    } catch (error) {
      console.error(`Error during search:`, error);
      return [];
    }
}
