const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', 'playwright-core', 'lib', 'coreBundle.js');

if (!fs.existsSync(targetFile)) {
  console.error(`[Custom MCP] Error: Target file not found: ${targetFile}`);
  console.error(`[Custom MCP] Please run 'bun install' first.`);
  process.exit(1);
}

console.log(`[Custom MCP] Reading ${targetFile}...`);
let content = fs.readFileSync(targetFile, 'utf8');

// Find and replace the createPersistentBrowser function
const oldFunc = `async function createPersistentBrowser(config, clientInfo) {
  testDebug3("create browser (persistent)");
  const userDataDir = config.browser.userDataDir ?? await createUserDataDir(config, clientInfo);
  const tracesDir = await computeTracesDir(config, clientInfo);
  if (await isProfileLocked5Times(userDataDir))
    throw new Error(\`Browser is already in use for \${userDataDir}, use --isolated to run multiple instances of the same browser\`);
  const browserType = playwright[config.browser.browserName];
  const configIgnoreDefaultArgs = config.browser.launchOptions?.ignoreDefaultArgs;
  const launchOptions = {
    tracesDir,
    ...config.browser.launchOptions,
    ...config.browser.contextOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
    ignoreDefaultArgs: configIgnoreDefaultArgs === true ? true : [
      "--disable-extensions",
      ...Array.isArray(configIgnoreDefaultArgs) ? configIgnoreDefaultArgs : []
    ]
  };
  try {
    const browserContext = await browserType.launchPersistentContext(userDataDir, launchOptions);
    const browser = browserContext.browser();
    return browser;
  } catch (error) {
    throwIfExecutableMissing(error, config);
    if (error.message.includes("cannot open shared object file: No such file or directory")) {
      const browserName = launchOptions.channel ?? config.browser.browserName;
      throw new Error(\`Missing system dependencies required to run browser \${browserName}. Install them with: sudo npx playwright install-deps \${browserName}\`);
    }
    if (error.message.includes("ProcessSingleton") || error.message.includes("exitCode=21"))
      throw new Error(\`Browser is already in use for \${userDataDir}, use --isolated to run multiple instances of the same browser\`);
    throw error;
  }
}`;

const newFunc = `async function createPersistentBrowser(config, clientInfo) {
  testDebug3("[Custom MCP] Starting createPersistentBrowser with Connect-or-Launch with Cleanup pattern...");
  
  const userDataDir = config.browser.userDataDir ?? await createUserDataDir(config, clientInfo);
  const tracesDir = await computeTracesDir(config, clientInfo);
  
  // 1. Connect-First Fallback
  let cdpPort = "9222";
  if (config.browser.launchOptions?.args) {
    for (const arg of config.browser.launchOptions.args) {
      if (arg.startsWith("--remote-debugging-port=")) {
        cdpPort = arg.split("=")[1];
      }
    }
  }
  const cdpUrl = \`http://127.0.0.1:\${cdpPort}\`;
  
  try {
    testDebug3(\`[Custom MCP] Attempting to connect to existing CDP session at \${cdpUrl}...\`);
    const browser = await playwright.chromium.connectOverCDP(cdpUrl, { timeout: 1500 });
    testDebug3("[Custom MCP] Successfully connected to existing CDP session!");
    
    // Make sure at least one context exists
    if (browser.contexts().length === 0) {
      testDebug3("[Custom MCP] No contexts found on connected browser. Creating a new context...");
      await browser.newContext(config.browser.contextOptions).catch(() => {});
    }
    
    // Override browserContext.close() to prevent closing user's daily-driver tabs
    const originalContexts = browser.contexts();
    if (originalContexts.length > 0) {
      const browserContext = originalContexts[0];
      browserContext.close = async () => {
        testDebug3("[Custom MCP] Skipping browserContext.close() to protect daily-driver tabs.");
      };
    }
    
    return browser;
  } catch (e) {
    testDebug3(\`[Custom MCP] No active CDP session found (\${e.message}). Proceeding with clean launch...\`);
  }

  // 2. Split Profile Arguments (Nested Profile Bug Fix)
  let baseDir = userDataDir;
  let profileDirectoryArg = undefined;
  
  const path = require('path');
  const fs = require('fs');
  const basename = path.basename(userDataDir);
  const parentDir = path.dirname(userDataDir);
  
  if (basename === "Default" || basename.startsWith("Profile ")) {
    baseDir = parentDir;
    profileDirectoryArg = \`--profile-directory=\${basename}\`;
    testDebug3(\`[Custom MCP] Split profile directory: baseDir="\${baseDir}", profileDir="\${basename}"\`);
  }

  // 3. SingletonLock/Cookie Cleanup (SingletonLock Panics Fix)
  const filesToUnlink = ['SingletonLock', 'SingletonCookie', 'lockfile'];
  for (const file of filesToUnlink) {
    const filePath = path.join(baseDir, file);
    try {
      if (fs.existsSync(filePath)) {
        testDebug3(\`[Custom MCP] Purging lock/cookie file: \${filePath}\`);
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      testDebug3(\`[Custom MCP] Note: Could not purge \${file}: \${err.message}\`);
    }
  }

  // Check locking again if profile was NOT split
  if (baseDir === userDataDir && await isProfileLocked5Times(userDataDir)) {
    throw new Error(\`Browser is already in use for \${userDataDir}, use --isolated to run multiple instances of the same browser\`);
  }

  // 4. Launch Options with Automation Infobar bypass and proper Args
  const browserType = playwright[config.browser.browserName];
  const configIgnoreDefaultArgs = config.browser.launchOptions?.ignoreDefaultArgs;
  
  const ignoreDefaultArgs = configIgnoreDefaultArgs === true ? true : [
    "--disable-extensions",
    "--enable-automation",
    ...Array.isArray(configIgnoreDefaultArgs) ? configIgnoreDefaultArgs : []
  ];
  
  const args = [
    ...config.browser.launchOptions?.args || []
  ];
  
  if (profileDirectoryArg && !args.some(a => a.startsWith("--profile-directory="))) {
    args.push(profileDirectoryArg);
  }
  if (!args.some(a => a.startsWith("--remote-debugging-port="))) {
    args.push(\`--remote-debugging-port=\${cdpPort}\`);
  }
  if (!args.some(a => a === "--start-maximized")) {
    args.push("--start-maximized");
  }

  const launchOptions = {
    tracesDir,
    ...config.browser.launchOptions,
    ...config.browser.contextOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
    ignoreDefaultArgs,
    args
  };

  try {
    testDebug3(\`[Custom MCP] Launching persistent context with baseDir="\${baseDir}"\`);
    const browserContext = await browserType.launchPersistentContext(baseDir, launchOptions);
    const browser = browserContext.browser();
    return browser;
  } catch (error) {
    throwIfExecutableMissing(error, config);
    if (error.message.includes("cannot open shared object file: No such file or directory")) {
      const browserName = launchOptions.channel ?? config.browser.browserName;
      throw new Error(\`Missing system dependencies required to run browser \${browserName}. Install them with: sudo npx playwright install-deps \${browserName}\`);
    }
    if (error.message.includes("ProcessSingleton") || error.message.includes("exitCode=21")) {
      throw new Error(\`Browser is already in use for \${baseDir}, use --isolated to run multiple instances of the same browser\`);
    }
    throw error;
  }
}`;

if (content.includes(newFunc)) {
  console.log('[Custom MCP] Code is already patched.');
  process.exit(0);
}

// Perform replacement
const updatedContent = content.replace(oldFunc, newFunc);

if (updatedContent === content) {
  console.error('[Custom MCP] Error: Could not locate createPersistentBrowser function in coreBundle.js for replacement.');
  process.exit(1);
}

fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('[Custom MCP] Successfully patched coreBundle.js with Connect-or-Launch and Cleanup pattern!');
