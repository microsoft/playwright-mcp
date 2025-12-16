import { test, expect, Page } from '@playwright/test';

const COMPANY_URL = 'https://www.digital.pumb.ua/registration/company/choose';

test.describe('ПУМБ Реєстрація юридичної особи', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    page.setDefaultTimeout(30000);
  });

  test('TC_PUMB_CO_001: Відображення головної сторінки реєстрації юр. особи', async () => {
    await page.goto(COMPANY_URL);
    await page.waitForLoadState('networkidle');

    // Основний заголовок флоу (текст може бути в однині/множині, тому перевіряємо частину фрази)
    const mainTitle = page.getByText(/ВІДКРИВАЄМО РАХУНОК ДЛЯ ЮРИДИЧН/i);
    await expect(mainTitle).toBeVisible();

    // Підзаголовок / пояснення
    const subtitle = page.locator('text=Оберіть спосіб відкриття рахунку');
    await expect(subtitle).toBeVisible();
  });

  test('TC_PUMB_CO_002: Варіанти способу відкриття рахунку', async () => {
    await page.goto(COMPANY_URL);
    await page.waitForLoadState('networkidle');

    // Ліва картка: "Самостійно" (онлайн‑процес) — працюємо з усією лінк‑карткою
    const selfOption = page.getByRole('link', {
      name: /Самостійно[\s\S]*Онлайн-процес/i,
    });
    await expect(selfOption).toBeVisible();

    // Вимога для самостійного відкриття рахунку (усередині тієї ж картки)
    await expect(selfOption.getByText('Застосунок Дія', { exact: false })).toBeVisible();
    await expect(selfOption.getByText('ID-карткою', { exact: false })).toBeVisible();
    await expect(selfOption.getByText('закордонним паспортом', { exact: false })).toBeVisible();

    // Права картка: "З менеджером" (відеоверифікація)
    const managerOption = page.getByRole('link', {
      name: /З менеджером[\s\S]*Відеоверифікація/i,
    });
    await expect(managerOption).toBeVisible();

    // Вимоги для відкриття рахунку з менеджером (усередині правої картки)
    await expect(managerOption.getByText('Камера на телефоні', { exact: false })).toBeVisible();
    await expect(managerOption.getByText('Скан-копії документів', { exact: false })).toBeVisible();
    await expect(managerOption.getByText('Кваліфікований електронний підпис', { exact: false })).toBeVisible();
  });

  test('TC_PUMB_CO_003: Промо-банер "Даруємо бізнесу нові можливості у Новому році"', async () => {
    await page.goto(COMPANY_URL);
    await page.waitForLoadState('networkidle');

    const promoBanner = page.locator('text=Даруємо бізнесу нові можливості у Новому році');
    await expect(promoBanner).toBeVisible();

    // На сторінці є два "Детальніше": у cookie-банері (link) та в промо-банері (button).
    // Обмежуємося кнопкою всередині промо-банера, щоб уникнути strict mode violation.
    const detailsButton = promoBanner.getByRole('button', { name: 'Детальніше' });
    await expect(detailsButton).toBeVisible();

    await detailsButton.click();
    await page.waitForTimeout(1000);
  });

  test('TC_PUMB_CO_004: Блок "ПУМБ Бізнес" та мобільний застосунок', async () => {
    await page.goto(COMPANY_URL);
    await page.waitForLoadState('networkidle');

    // Текст "ПУМБ Бізнес" може бути візуально прихованим (наприклад, у хедері),
    // тому перевіряємо, що він присутній у DOM, не вимагаючи видимості.
    const businessBlock = page.locator('text=ПУМБ Бізнес');
    await expect(businessBlock).toHaveCount(1);

    const mobileAppTitle = page.locator('text=Мобільний застосунок');
    await expect(mobileAppTitle).toBeVisible();

    const mobileAppButton = page.locator('text=Перейти');
    await expect(mobileAppButton).toBeVisible();
    await expect(mobileAppButton).toBeEnabled();
  });

  test('TC_PUMB_CO_005: Контактна інформація для бізнесу', async () => {
    await page.goto(COMPANY_URL);
    await page.waitForLoadState('networkidle');

    const phoneNumber = page.locator('text=0 800 501 275');
    await expect(phoneNumber).toBeVisible();

    const phoneLink = page.locator('a[href*="tel:"]');
    await expect(phoneLink).toBeVisible();
  });

  test('TC_PUMB_CO_006: Адаптивність сторінки для юр. осіб', async () => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(COMPANY_URL);
      await page.waitForLoadState('networkidle');

      const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ЮРИДИЧНОЇ ОСОБИ');
      await expect(mainTitle).toBeVisible();

      const phoneNumber = page.locator('text=0 800 501 275');
      await expect(phoneNumber).toBeVisible();
    }
  });

  test('TC_PUMB_CO_007: Наявність кнопки "Повернутись"', async () => {
    await page.goto(COMPANY_URL);
    await page.waitForLoadState('networkidle');

    const backButton = page.locator('text=Повернутись');
    await expect(backButton).toBeVisible();
    await expect(backButton).toBeEnabled();
  });
});


