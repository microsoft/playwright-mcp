import { defineConfig, devices } from '@playwright/test';

/**
 * Конфігурація Playwright для тестування тільки в Google Chrome
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  /* Запускати тести послідовно для стабільності */
  fullyParallel: false,
  /* Заборона test.only на CI */
  forbidOnly: !!process.env.CI,
  /* Повторити тести на CI при падінні */
  retries: process.env.CI ? 2 : 0,
  /* Один воркер для стабільності */
  workers: 1,
  /* Репортери для звітності */
  reporter: [
    ['html', { outputFolder: 'chrome-test-results/html-report' }],
    ['json', { outputFile: 'chrome-test-results/results.json' }],
    ['junit', { outputFile: 'chrome-test-results/results.xml' }],
    ['list'] // Консольний вивід
  ],
  /* Загальні налаштування для всіх тестів */
  use: {
    /* Базовий URL (якщо потрібно) */
    // baseURL: 'https://www.digital.pumb.ua',

    /* Збирати трасування при повторі падіння */
    trace: 'on-first-retry',
    
    /* Скріншоти при падінні */
    screenshot: 'only-on-failure',
    
    /* Запис відео при падінні */
    video: 'retain-on-failure',
    
    /* Таймаут для дій */
    actionTimeout: 10000,
    
    /* Таймаут для навігації */
    navigationTimeout: 30000,
    
    /* Додаткові HTTP заголовки */
    extraHTTPHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  },

  /* Конфігурація тільки для Google Chrome */
  projects: [
    {
      name: 'Google Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Додаткові налаштування для Chrome
        channel: 'chrome', // Використовувати системний Chrome
        headless: false, // Показувати браузер під час тестування
        viewport: { width: 1280, height: 720 },
        // Налаштування для обходу блокувань
        ignoreHTTPSErrors: true,
        // Додаткові аргументи для Chrome
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images', // Прискорення завантаження
            '--disable-javascript-harmony-shipping',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
    },
  ],

  /* Глобальні setup та teardown */
  globalSetup: require.resolve('./global-setup-chrome.ts'),
  globalTeardown: require.resolve('./global-teardown-chrome.ts'),
  
  /* Директорія для результатів тестів */
  outputDir: 'chrome-test-results/',
  
  /* Таймаут для кожного тесту */
  timeout: 60000,
  
  /* Таймаут для expect */
  expect: {
    timeout: 10000
  },

  /* Налаштування для CI/CD */
  ...(process.env.CI && {
    use: {
      // На CI використовувати headless режим
      headless: true,
    }
  })
});







