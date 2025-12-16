import { defineConfig, devices } from '@playwright/test';

/**
 * Конфігурація Playwright для флоу:
 * "ВІДКРИВАЄМО РАХУНОК ДЛЯ ЮРИДИЧНОЇ ОСОБИ"
 * https://www.digital.pumb.ua/registration/company/choose
 */
export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Без ретраїв: кожен тест виконується один раз
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/',
  timeout: 60000,
  expect: {
    timeout: 10000
  }
});


