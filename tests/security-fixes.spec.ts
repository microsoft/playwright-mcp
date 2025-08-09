/**
 * Security fixes validation tests
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.describe('Security Fixes Validation', () => {
  test('hardcoded password should be replaced with environment variable', async () => {
    // Read the testserver file and verify it uses environment variable
    const testServerPath = path.join(
      process.cwd(),
      'tests/testserver/index.ts'
    );
    const content = await fs.readFile(testServerPath, 'utf-8');

    // Check that hardcoded 'aaaa' password is removed
    expect(content).not.toContain("passphrase: 'aaaa'");

    // Check that environment variable is used
    expect(content).toContain('process.env.TEST_SSL_PASSPHRASE');
    expect(content).toContain('test-default-passphrase');
  });

  test('command injection should be prevented in execSync calls', async () => {
    // Check library.spec.ts uses safe spawnSync with array arguments
    const librarySpecPath = path.join(process.cwd(), 'tests/library.spec.ts');
    const libraryContent = await fs.readFile(librarySpecPath, 'utf-8');

    // Should use safe spawnSync with array form and shell: false
    expect(libraryContent).toContain("spawnSync('node', [file]");
    expect(libraryContent).toContain('shell: false');
    // Should not contain dangerous template string injection
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing for template string pattern
    expect(libraryContent).not.toContain('execSync(`node ${file}`)');

    // Check update-readme.js uses secure options
    const updateReadmePath = path.join(process.cwd(), 'utils/update-readme.js');
    const updateReadmeContent = await fs.readFile(updateReadmePath, 'utf-8');

    // Should use spawnSync with secure options including shell: false and cwd
    expect(updateReadmeContent).toContain('spawnSync(');
    expect(updateReadmeContent).toContain('shell: false');
    expect(updateReadmeContent).toContain('cwd: currentDir');
  });

  test('HTML encoding should prevent XSS in generated content', async () => {
    // Check update-readme.js uses HTML encoding for capability names
    const updateReadmePath = path.join(process.cwd(), 'utils/update-readme.js');
    const updateReadmeContent = await fs.readFile(updateReadmePath, 'utf-8');

    // Should escape HTML characters in capability names
    expect(updateReadmeContent).toContain('replace(/[<>&"\']/g');
    expect(updateReadmeContent).toContain('&lt;');
    expect(updateReadmeContent).toContain('&gt;');
    expect(updateReadmeContent).toContain('&amp;');
  });
});
