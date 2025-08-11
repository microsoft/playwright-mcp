import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// Regular expressions used in multiple tests
const NPM_CI_IGNORE_SCRIPTS_REGEX = /npm ci[^&]*--ignore-scripts/;
const CHOWN_USERNAME_REGEX = /--chown=\$\{USERNAME\}:\$\{USERNAME\}/;
const CHOWN_ROOT_REGEX = /--chown=root/;
const CHOWN_NUMERIC_REGEX = /--chown=0:/;
const USER_USERNAME_REGEX = /USER \${USERNAME}/;
const PROCESS_ENV_SPREAD_REGEX = /\.\.\.process\.env,/;
const PATH_ASSIGNMENT_REGEX = /PATH\s*:/;
const PROCESS_ENV_PATH_REGEX = /process\.env\.PATH/;

test.describe('Docker Security Tests', () => {
  test('Dockerfile should use --ignore-scripts for npm install', () => {
    const dockerfilePath = join(process.cwd(), 'Dockerfile');
    const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');

    // Check that all npm ci commands include --ignore-scripts
    const npmCiLines = dockerfileContent
      .split('\n')
      .filter((line) => line.includes('npm ci'));

    expect(npmCiLines.length).toBeGreaterThan(0);

    for (const line of npmCiLines) {
      // Each npm ci command should include --ignore-scripts for security
      expect(line).toMatch(NPM_CI_IGNORE_SCRIPTS_REGEX);
    }
  });

  test('Dockerfile should have proper file permissions for COPY commands', () => {
    const dockerfilePath = join(process.cwd(), 'Dockerfile');
    const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');

    // Check that COPY commands with --chown use restrictive permissions
    const copyLines = dockerfileContent
      .split('\n')
      .filter(
        (line) => line.trim().startsWith('COPY') && line.includes('--chown')
      );

    expect(copyLines.length).toBeGreaterThan(0);

    for (const line of copyLines) {
      // All COPY commands with --chown should use the USERNAME variable
      expect(line).toMatch(CHOWN_USERNAME_REGEX);
      // Should not use root or hardcoded user IDs
      expect(line).not.toMatch(CHOWN_ROOT_REGEX);
      expect(line).not.toMatch(CHOWN_NUMERIC_REGEX);
    }
  });

  test('Dockerfile should run as non-root user', () => {
    const dockerfilePath = join(process.cwd(), 'Dockerfile');
    const dockerfileContent = readFileSync(dockerfilePath, 'utf-8');

    // Check that USER directive is present
    const userLines = dockerfileContent
      .split('\n')
      .filter((line) => line.trim().startsWith('USER'));

    expect(userLines.length).toBeGreaterThan(0);
    expect(userLines[0]).toMatch(USER_USERNAME_REGEX);
  });

  test('process.env usage should be safe in test files', () => {
    // This test verifies that process.env is used safely in test files
    // by checking that no direct PATH manipulation occurs

    const testFiles = ['tests/http.spec.ts', 'tests/sse.spec.ts'];

    for (const filePath of testFiles) {
      const fullPath = join(process.cwd(), filePath);
      const content = readFileSync(fullPath, 'utf-8');

      // Check that env spreading doesn't include direct PATH manipulation
      const processEnvLines = content
        .split('\n')
        .filter((line) => line.includes('...process.env'));

      for (const line of processEnvLines) {
        // Verify that the spread pattern is safe - should be inside an object
        expect(line).toMatch(PROCESS_ENV_SPREAD_REGEX);
        // Should not directly assign to PATH
        expect(line).not.toMatch(PATH_ASSIGNMENT_REGEX);
        expect(line).not.toMatch(PROCESS_ENV_PATH_REGEX);
      }
    }
  });
});
