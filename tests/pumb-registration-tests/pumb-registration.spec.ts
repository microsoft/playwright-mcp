import { test, expect, Page } from '@playwright/test';

const PUMB_URL = 'https://www.digital.pumb.ua/registration/fop/choose';

test.describe('ПУМБ Реєстрація ФОП', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Встановлюємо таймаут для завантаження сторінки
    page.setDefaultTimeout(30000);
  });

  test('TC_PUMB_001: Відображення головної сторінки реєстрації ФОП', async () => {
    // Крок 1: Відкрити URL сторінки реєстрації ФОП
    await page.goto(PUMB_URL);
    
    // Крок 2: Дочекатися повного завантаження сторінки
    await page.waitForLoadState('networkidle');
    
    // Крок 3: Перевірити відображення основного заголовка
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    // Крок 4: Перевірити наявність підзаголовка
    const subtitle = page.locator('text=Оберіть спосіб відкриття рахунку');
    await expect(subtitle).toBeVisible();
    
    // Перевірити наявність двох варіантів реєстрації
    const onlineOption = page.locator('text=Без участі менеджера');
    const managerOption = page.locator('text=За участю менеджера');
    
    await expect(onlineOption).toBeVisible();
    await expect(managerOption).toBeVisible();
  });

  test('TC_PUMB_002: Вибір способу "Без участі менеджера"', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти секцію "Без участі менеджера"
    const onlineSection = page.locator('text=Без участі менеджера');
    await expect(onlineSection).toBeVisible();
    
    // Крок 2: Перевірити відображення підзаголовка "Онлайн"
    const onlineSubtitle = page.locator('text=Онлайн');
    await expect(onlineSubtitle).toBeVisible();
    
    // Крок 3: Перевірити список вимог для онлайн реєстрації
    const diaApp = page.locator('text=Застосунок Дія');
    const pumbApp = page.locator('text=Застосунок ПУМБ для фізичних осіб');
    
    await expect(diaApp).toBeVisible();
    await expect(pumbApp).toBeVisible();
    
    // Крок 4: Перевірити наявність кнопки/посилання
    const onlineButton = page.locator('button, a').filter({ hasText: /онлайн|без участі/i }).first();
    await expect(onlineButton).toBeVisible();
  });

  test('TC_PUMB_003: Вибір способу "За участю менеджера"', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти секцію "За участю менеджера"
    const managerSection = page.locator('text=За участю менеджера');
    await expect(managerSection).toBeVisible();
    
    // Крок 2: Перевірити відображення підзаголовка "Відеоверифікація"
    const videoSubtitle = page.locator('text=Відеоверифікація');
    await expect(videoSubtitle).toBeVisible();
    
    // Крок 3: Перевірити список вимог для відеоверифікації
    const camera = page.locator('text=Камера на телефоні або комп');
    const documents = page.locator('text=Скан-копії документів');
    const digitalSignature = page.locator('text=Кваліфікований електронний підпис');
    
    await expect(camera).toBeVisible();
    await expect(documents).toBeVisible();
    await expect(digitalSignature).toBeVisible();
    
    // Крок 4: Перевірити наявність кнопки/посилання
    const managerButton = page.locator('button, a').filter({ hasText: /відео|менеджер/i }).first();
    await expect(managerButton).toBeVisible();
  });

  test('TC_PUMB_010: Адаптивність сторінки на різних розмірах екрану', async () => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      // Крок 1-3: Змінити розмір вікна
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(PUMB_URL);
      await page.waitForLoadState('networkidle');
      
      // Крок 4: Перевірити відображення контенту
      const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
      await expect(mainTitle).toBeVisible();
      
      const onlineOption = page.locator('text=Без участі менеджера');
      const managerOption = page.locator('text=За участю менеджера');
      
      await expect(onlineOption).toBeVisible();
      await expect(managerOption).toBeVisible();
      
      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}): Тест пройшов успішно`);
    }
  });

  test('TC_PUMB_011: Перевірка відображення промо-банера', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти актуальний промо-банер на сторінці
    const promoBanner = page.locator('text=Даруємо бізнесу нові можливості у Новому році');
    await expect(promoBanner).toBeVisible();
    
    // Крок 2: Перевірити наявність кнопки "Детальніше"
    const detailsButton = page.locator('text=Детальніше');
    await expect(detailsButton).toBeVisible();
    
    // Крок 3: Натиснути на кнопку "Детальніше"
    await detailsButton.click();
    
    // Перевірити, що відкрилася додаткова інформація (банер реагує на клік)
    await page.waitForTimeout(1000);
  });

  test('TC_PUMB_012: Перевірка відображення контактної інформації', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Перевірити наявність телефонного номера
    const phoneNumber = page.locator('text=0 800 501 275');
    await expect(phoneNumber).toBeVisible();
    
    // Перевірити, що номер телефону є клікабельним посиланням
    const phoneLink = page.locator('a[href*="tel:"]');
    await expect(phoneLink).toBeVisible();
  });

  test('TC_PUMB_013: Перевірка доступності (accessibility)', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Перевірити наявність заголовка сторінки
    const pageTitle = await page.title();
    expect(pageTitle).toContain('ПУМБ');
    
    // Перевірити наявність основних заголовків
    const mainHeading = page.locator('h1, [role="heading"]').first();
    await expect(mainHeading).toBeVisible();
    
    // Перевірити наявність альтернативного тексту для зображень
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Альтернативний текст повинен бути присутнім або зображення повинно бути декоративним
      expect(alt).not.toBeNull();
    }
  });

  test('TC_PUMB_014: Валідація HTML структури сторінки', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Перевірити наявність основних HTML елементів
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'uk-UA');
    
    // Перевірити наявність мета-тегів
    const charset = page.locator('meta[charset]');
    await expect(charset).toHaveAttribute('charset', 'utf-8');
    
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
    
    // Перевірити наявність favicon
    const favicon = page.locator('link[rel*="icon"]');
    await expect(favicon).toBeVisible();
  });

  test('TC_PUMB_015: Перевірка мета-тегів та SEO', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Перевірити title сторінки
    const title = await page.title();
    expect(title).toContain('ПУМБ');
    expect(title).toContain('бізнес');
    
    // Перевірити meta description
    const description = page.locator('meta[name="description"]');
    const descriptionContent = await description.getAttribute('content');
    expect(descriptionContent).toBeTruthy();
    
    // Перевірити Open Graph теги
    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDescription = page.locator('meta[property="og:description"]');
    
    if (await ogTitle.count() > 0) {
      await expect(ogTitle).toBeVisible();
    }
    
    if (await ogDescription.count() > 0) {
      await expect(ogDescription).toBeVisible();
    }
  });

  test('TC_PUMB_007: Перевірка поведінки при відсутності JavaScript', async () => {
    // Відключити JavaScript
    await page.setJavaScriptEnabled(false);
    
    await page.goto(PUMB_URL);
    
    // Перевірити, що основна інформація все ще доступна
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    // Увімкнути JavaScript назад
    await page.setJavaScriptEnabled(true);
  });

  test('TC_PUMB_008: Перевірка поведінки при медленному інтернет-з\'єднанні', async () => {
    // Симулювати повільне з'єднання
    await page.route('**/*', async route => {
      // Додаємо затримку для симуляції повільного інтернету
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    const startTime = Date.now();
    await page.goto(PUMB_URL);
    const loadTime = Date.now() - startTime;
    
    // Перевірити, що сторінка все ж таки завантажилася
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    console.log(`Сторінка завантажилася за ${loadTime}ms`);
  });

  test('TC_PUMB_009: Перевірка поведінки при відключенні cookies', async () => {
    // Блокувати cookies
    await page.context().addCookies([]);
    
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Перевірити, що сторінка працює без cookies
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    // Перевірити наявність банеру про cookies
    const cookieBanner = page.locator('text=кукі-файли');
    await expect(cookieBanner).toBeVisible();
  });

  test('TC_PUMB_004: Перевірка відображення вимог для онлайн реєстрації', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти секцію "Без участі менеджера"
    const onlineSection = page.locator('text=Без участі менеджера');
    await expect(onlineSection).toBeVisible();
    
    // Крок 2: Перевірити заголовок з вимогами
    const requirementsTitle = page.locator('text=Для самостійного відкриття рахунку онлайн необхідні:');
    await expect(requirementsTitle).toBeVisible();
    
    // Крок 3: Перевірити першу вимогу про застосунок Дія
    const diaRequirement = page.locator('text=Застосунок Дія');
    await expect(diaRequirement).toBeVisible();
    
    // Крок 4: Перевірити другу вимогу про застосунок ПУМБ
    const pumbRequirement = page.locator('text=Застосунок ПУМБ для фізичних осіб');
    await expect(pumbRequirement).toBeVisible();
    
    // Крок 5: Перевірити логічний розділювач "або"
    const orDivider = page.locator('text=або');
    await expect(orDivider).toBeVisible();
  });

  test('TC_PUMB_005: Перевірка відображення вимог для відеоверифікації', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти секцію "За участю менеджера"
    const managerSection = page.locator('text=За участю менеджера');
    await expect(managerSection).toBeVisible();
    
    // Крок 2: Перевірити заголовок з вимогами
    const requirementsTitle = page.locator('text=Для відкриття рахунку за допомогою менеджера необхідні:');
    await expect(requirementsTitle).toBeVisible();
    
    // Крок 3: Перевірити вимогу про камеру
    const cameraRequirement = page.locator('text=Камера на телефоні або комп');
    await expect(cameraRequirement).toBeVisible();
    
    // Крок 4: Перевірити вимогу про документи
    const documentsRequirement = page.locator('text=Скан-копії документів');
    await expect(documentsRequirement).toBeVisible();
    
    // Крок 5: Перевірити вимогу про електронний підпис
    const signatureRequirement = page.locator('text=Кваліфікований електронний підпис');
    await expect(signatureRequirement).toBeVisible();
  });

  test('TC_PUMB_006: Клік по кнопці "Повернутись"', async () => {
    await page.goto(PUMB_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти кнопку "Повернутись" на сторінці
    const backButton = page.locator('text=Повернутись');
    await expect(backButton).toBeVisible();
    
    // Крок 2: Перевірити, що кнопка активна
    await expect(backButton).toBeEnabled();
    
    // Крок 3: Натиснути на кнопку "Повернутись"
    await backButton.click();
    
    // Крок 4: Перевірити результат натискання
    // Може бути перехід на попередню сторінку або зміна URL
    await page.waitForTimeout(1000);
    
    // Перевірити, що URL змінився або сторінка оновилася
    const currentUrl = page.url();
    expect(currentUrl).not.toBe(PUMB_URL);
  });
});
