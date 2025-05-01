// @ts-check

/**
 * Workspace utility for Limetest monorepo
 * Ensures consistent versioning and copies files across packages
 */

import * as fs from 'fs';
import * as path from 'path';

interface PackageDescriptor {
  name: string;
  path: string;
  files: string[];
}

interface PackageJSON {
  name: string;
  version: string;
  private?: boolean;
  repository?: any;
  engines?: any;
  homepage?: any;
  author?: any;
  license?: any;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

class LimePackage {
  name: string;
  path: string;
  files: string[];
  packageJSONPath: string;
  packageJSON: PackageJSON;
  isPrivate: boolean;

  constructor(descriptor: PackageDescriptor) {
    this.name = descriptor.name;
    this.path = descriptor.path;
    this.files = descriptor.files;
    this.packageJSONPath = path.join(this.path, 'package.json');
    this.packageJSON = JSON.parse(fs.readFileSync(this.packageJSONPath, 'utf8'));
    this.isPrivate = !!this.packageJSON.private;
  }
}

class Workspace {
  private _rootDir: string;
  private _packages: LimePackage[];

  constructor(rootDir: string, packages: LimePackage[]) {
    this._rootDir = rootDir;
    this._packages = packages;
  }

  packages(): LimePackage[] {
    return this._packages;
  }

  async version(): Promise<string> {
    const workspacePackageJSON = await readJSON(path.join(this._rootDir, 'package.json'));
    return workspacePackageJSON.version;
  }

  async setVersion(version: string): Promise<void> {
    if (version.startsWith('v'))
      throw new Error('version must not start with "v"');

    // 1. update workspace's package.json with the new version
    const workspacePackageJSON = await readJSON(path.join(this._rootDir, 'package.json'));
    workspacePackageJSON.version = version;
    await writeJSON(path.join(this._rootDir, 'package.json'), workspacePackageJSON);
    // 2. make workspace consistent
    await this.ensureConsistent();
  }

  async ensureConsistent(): Promise<boolean> {
    let hasChanges = false;

    const maybeWriteJSON = async (jsonPath: string, json: any): Promise<void> => {
      const oldJson = await readJSON(jsonPath);
      if (JSON.stringify(json) === JSON.stringify(oldJson))
        return;
      hasChanges = true;
      console.warn('Updated', jsonPath);
      await writeJSON(jsonPath, json);
    };

    const workspacePackageJSON = await readJSON(path.join(this._rootDir, 'package.json'));
    const version = workspacePackageJSON.version;

    for (const pkg of this._packages) {
      // 1. Copy files specified for each package
      for (const file of pkg.files) {
        const fromPath = path.join(this._rootDir, file);
        const toPath = path.join(pkg.path, file);
        await fs.promises.mkdir(path.dirname(toPath), { recursive: true });
        await fs.promises.copyFile(fromPath, toPath);
        console.log(`Copied ${file} to ${pkg.name}`);
      }

      // 2. Make sure package's package.jsons are consistent
      if (!pkg.isPrivate) {
        pkg.packageJSON.version = version;
        pkg.packageJSON.repository = workspacePackageJSON.repository;
        pkg.packageJSON.engines = workspacePackageJSON.engines;
        pkg.packageJSON.homepage = workspacePackageJSON.homepage;
        pkg.packageJSON.author = workspacePackageJSON.author;
        pkg.packageJSON.license = workspacePackageJSON.license;
      }

      // 3. Handle internal dependencies - always use workspace:* for local development
      for (const otherPackage of this._packages) {
        if (pkg.packageJSON.dependencies && pkg.packageJSON.dependencies[otherPackage.name]) {
          // Only replace with workspace:* if it's not already using the workspace protocol
          if (!pkg.packageJSON.dependencies[otherPackage.name].startsWith('workspace:'))
            pkg.packageJSON.dependencies[otherPackage.name] = 'workspace:*';

        }
        if (pkg.packageJSON.devDependencies && pkg.packageJSON.devDependencies[otherPackage.name]) {
          if (!pkg.packageJSON.devDependencies[otherPackage.name].startsWith('workspace:'))
            pkg.packageJSON.devDependencies[otherPackage.name] = 'workspace:*';

        }
      }
      await maybeWriteJSON(pkg.packageJSONPath, pkg.packageJSON);
    }

    return hasChanges;
  }
}

const readJSON = async (filePath: string): Promise<any> =>
  JSON.parse(await fs.promises.readFile(filePath, 'utf8'));

const writeJSON = async (filePath: string, json: any): Promise<void> => {
  await fs.promises.writeFile(filePath, JSON.stringify(json, null, 2) + '\n');
};

// Root directory is one level up from utils
const ROOT_PATH = path.join(__dirname, '..');
const LICENSE_FILES = ['LICENSE'];

// Create workspace with all packages - copy README to limetest and core but not mcp
const workspace = new Workspace(ROOT_PATH, [
  new LimePackage({
    name: '@limetest/core',
    path: path.join(ROOT_PATH, 'packages', 'core'),
    files: [...LICENSE_FILES, 'README.md'], // Copy LICENSE and README to core package
  }),
  new LimePackage({
    name: '@limetest/limetest',
    path: path.join(ROOT_PATH, 'packages', 'limetest'),
    files: [...LICENSE_FILES, 'README.md'], // Copy LICENSE and README to limetest package
  }),
  new LimePackage({
    name: '@limetest/mcp',
    path: path.join(ROOT_PATH, 'packages', 'mcp'),
    files: LICENSE_FILES, // Only copy LICENSE to mcp, not README
  }),
]);

// CLI handling
function die(message: string, exitCode = 1): never {
  console.error(message);
  process.exit(exitCode);
}

async function parseCLI() {
  const commands: Record<string, (arg?: string) => Promise<void>> = {
    '--ensure-consistent': async () => {
      const hasChanges = await workspace.ensureConsistent();
      if (hasChanges)
        die(`\n  ERROR: workspace is inconsistent! Run 'node utils/workspace.js --ensure-consistent' and commit changes!`);
    },
    '--list-public-package-paths': async () => {
      for (const pkg of workspace.packages()) {
        if (!pkg.isPrivate)
          console.log(pkg.path);
      }
    },
    '--get-version': async () => {
      console.log(await workspace.version());
    },
    '--set-version': async version => {
      if (!version)
        die('ERROR: Please specify version! e.g. --set-version 1.0.0');
      await workspace.setVersion(version);
    },
    '--help': async () => {
      console.log([
        `Available commands:`,
        ...Object.keys(commands).map(cmd => '  ' + cmd),
      ].join('\n'));
    },
  };

  const arg = process.argv[2];
  const handler = commands[arg];
  if (!handler)
    die('ERROR: wrong usage! Run with --help to list commands');
  await handler(process.argv[3]);
}

// Run if this is the main module
if (require.main === module)
  parseCLI().catch(console.error);
else
  module.exports = { workspace };
