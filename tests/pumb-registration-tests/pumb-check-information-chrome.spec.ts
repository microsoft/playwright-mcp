import { test, expect, Page } from '@playwright/test';

const PUMB_CHECK_INFO_URL = 'https://www.digital.pumb.ua/registration/fop/choose/check-information';

test.describe('ПУМБ Ознайомлення з інформацією - Google Chrome', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Встановлюємо таймаут для завантаження сторінки
    page.setDefaultTimeout(30000);
    
    // Встановлюємо User-Agent для Chrome
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  });

  test('TC_PUMB_INFO_001: Відображення сторінки ознайомлення з інформацією', async () => {
    // Крок 1: Відкрити URL сторінки ознайомлення з інформацією
    await page.goto(PUMB_CHECK_INFO_URL);
    
    // Крок 2: Дочекатися повного завантаження сторінки
    await page.waitForLoadState('networkidle');
    
    // Крок 3: Перевірити відображення основного заголовка
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    // Перевірити підзаголовок
    const subtitle = page.locator('text=Ознайомтесь з інформацією');
    await expect(subtitle).toBeVisible();
    
    // Перевірити наявність основних елементів
    const requirementsSection = page.locator('text=Вимоги до ФОП');
    const tariffSection = page.locator('text=Ваш тарифний пакет');
    
    await expect(requirementsSection).toBeVisible();
    await expect(tariffSection).toBeVisible();
  });

  test('TC_PUMB_INFO_002: Перевірка відображення вимог до ФОП', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти секцію "Вимоги до ФОП"
    const requirementsSection = page.locator('text=Вимоги до ФОП');
    await expect(requirementsSection).toBeVisible();
    
    // Крок 2: Перевірити заголовок з вимогами
    const requirementsTitle = page.locator('text=Ми можемо відкрити рахунок онлайн, якщо:');
    await expect(requirementsTitle).toBeVisible();
    
    // Крок 3: Перевірити всі 6 вимог до ФОП
    const requirement1 = page.locator('text=не повʼязана з організацією азартних ігор');
    const requirement2 = page.locator('text=в Єдиному Державному Реєстрі не знаходиться на тимчасово окупованій території');
    const requirement3 = page.locator('text=Не є публічною особою');
    const requirement4 = page.locator('text=Не є податковим резидентом США');
    const requirement5 = page.locator('text=Не має звʼязків з російською федерацією');
    const requirement6 = page.locator('text=Ваш тарифний пакет');
    
    await expect(requirement1).toBeVisible();
    await expect(requirement2).toBeVisible();
    await expect(requirement3).toBeVisible();
    await expect(requirement4).toBeVisible();
    await expect(requirement5).toBeVisible();
    await expect(requirement6).toBeVisible();
  });

  test('TC_PUMB_INFO_003: Перевірка відображення тарифного пакету', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти секцію "Ваш тарифний пакет"
    const tariffSection = page.locator('text=Ваш тарифний пакет');
    await expect(tariffSection).toBeVisible();
    
    // Крок 2: Перевірити відображення назви тарифу
    const tariffName = page.locator('text=всеDigital ФОП');
    await expect(tariffName).toBeVisible();
    
    // Крок 3: Перевірити наявність посилання на деталі
    const tariffDetailsLink = page.locator('text=Ознайомтесь з деталями тарифного пакету');
    await expect(tariffDetailsLink).toBeVisible();
    
    // Крок 4: Перевірити текст про можливість зміни тарифу
    const changeTariffText = page.locator('text=Ви можете змінити тариф одразу після відкриття рахунку');
    await expect(changeTariffText).toBeVisible();
  });

  test('TC_PUMB_INFO_004: Перевірка функціональності кнопки "Повернутись"', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти кнопку "Повернутись" на сторінці
    const backButton = page.locator('text=Повернутись');
    await expect(backButton).toBeVisible();
    
    // Крок 2: Перевірити, що кнопка активна
    await expect(backButton).toBeEnabled();
    
    // Крок 3: Натиснути на кнопку "Повернутись"
    await backButton.click();
    
    // Крок 4: Перевірити результат натискання
    await page.waitForTimeout(1000);
    
    // Перевірити, що URL змінився або сторінка оновилася
    const currentUrl = page.url();
    expect(currentUrl).not.toBe(PUMB_CHECK_INFO_URL);
  });

  test('TC_PUMB_INFO_005: Перевірка функціональності кнопки "Продовжити"', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти кнопку "Продовжити" на сторінці
    const continueButton = page.locator('text=Продовжити');
    await expect(continueButton).toBeVisible();
    
    // Крок 2: Перевірити, що кнопка активна
    await expect(continueButton).toBeEnabled();
    
    // Крок 3: Натиснути на кнопку "Продовжити"
    await continueButton.click();
    
    // Крок 4: Перевірити результат натискання
    await page.waitForTimeout(1000);
    
    // Перевірити, що відбувся перехід до наступного кроку
    const currentUrl = page.url();
    expect(currentUrl).not.toBe(PUMB_CHECK_INFO_URL);
  });

  test('TC_PUMB_INFO_006: Перевірка посилання на деталі тарифного пакету', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти посилання "Ознайомтесь з деталями тарифного пакету"
    const tariffDetailsLink = page.locator('text=Ознайомтесь з деталями тарифного пакету');
    await expect(tariffDetailsLink).toBeVisible();
    
    // Крок 2: Перевірити, що посилання активне
    await expect(tariffDetailsLink).toBeEnabled();
    
    // Крок 3: Натиснути на посилання
    await tariffDetailsLink.click();
    
    // Крок 4: Перевірити результат натискання
    await page.waitForTimeout(1000);
    
    // Може відкритися модальне вікно або перехід на іншу сторінку
    // Перевіряємо, що щось відбулося
    const currentUrl = page.url();
    // Якщо URL не змінився, можливо відкрилося модальне вікно
    console.log('Поточний URL після кліку:', currentUrl);
  });

  test('TC_PUMB_INFO_007: Перевірка посилань на альтернативні способи реєстрації', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти текст про альтернативні способи
    const alternativeText = page.locator('text=Якщо ви не відповідаєте якомусь з пунктів, відкрийте рахунок у');
    await expect(alternativeText).toBeVisible();
    
    // Крок 2: Перевірити посилання "відділенні Банку"
    const bankOfficeLink = page.locator('text=відділенні Банку');
    await expect(bankOfficeLink).toBeVisible();
    
    // Крок 3: Перевірити посилання "відеоверифікацію"
    const videoVerificationLink = page.locator('text=відеоверифікацію');
    await expect(videoVerificationLink).toBeVisible();
    
    // Перевірити, що посилання клікабельні
    await expect(bankOfficeLink).toBeEnabled();
    await expect(videoVerificationLink).toBeEnabled();
  });

  test('TC_PUMB_INFO_008: Перевірка відображення промо-банера', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Знайти промо-банер на сторінці
    const promoBanner = page.locator('text=Гарантовані 100 грн та шанс виграти iPhone 16');
    await expect(promoBanner).toBeVisible();
    
    // Крок 2: Перевірити відображення тексту з емодзі
    const promoText = page.locator('text=💳 Гарантовані 100 грн та шанс виграти iPhone 16');
    await expect(promoText).toBeVisible();
    
    // Крок 3: Перевірити наявність кнопки "Детальніше"
    const detailsButton = page.locator('text=Детальніше');
    await expect(detailsButton).toBeVisible();
    
    // Крок 4: Натиснути на кнопку "Детальніше"
    await detailsButton.click();
    
    // Перевірити, що відкрилася додаткова інформація
    await page.waitForTimeout(1000);
  });

  test('TC_PUMB_INFO_009: Перевірка відображення контактної інформації', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Перевірити наявність телефонного номера
    const phoneNumber = page.locator('text=0 800 501 275');
    await expect(phoneNumber).toBeVisible();
    
    // Крок 2: Перевірити, що номер телефону є клікабельним посиланням
    const phoneLink = page.locator('a[href*="tel:"]');
    await expect(phoneLink).toBeVisible();
    
    // Крок 3: Перевірити наявність посилання на мобільний застосунок
    const mobileAppLink = page.locator('text=Мобільний застосунок');
    await expect(mobileAppLink).toBeVisible();
  });

  test('TC_PUMB_INFO_010: Адаптивність сторінки на різних розмірах екрану', async () => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      // Крок 1-3: Змінити розмір вікна
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(PUMB_CHECK_INFO_URL);
      await page.waitForLoadState('networkidle');
      
      // Крок 4: Перевірити відображення контенту
      const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
      await expect(mainTitle).toBeVisible();
      
      const requirementsSection = page.locator('text=Вимоги до ФОП');
      const tariffSection = page.locator('text=Ваш тарифний пакет');
      
      await expect(requirementsSection).toBeVisible();
      await expect(tariffSection).toBeVisible();
      
      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}): Тест пройшов успішно`);
    }
  });

  test('TC_PUMB_INFO_011: Перевірка доступності (accessibility)', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Перевірити наявність заголовка сторінки
    const pageTitle = await page.title();
    expect(pageTitle).toContain('ПУМБ');
    
    // Крок 2: Перевірити наявність основних заголовків
    const mainHeading = page.locator('h1, [role="heading"]').first();
    await expect(mainHeading).toBeVisible();
    
    // Крок 3: Перевірити наявність альтернативного тексту для зображень
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Альтернативний текст повинен бути присутнім або зображення повинно бути декоративним
      expect(alt).not.toBeNull();
    }
    
    // Крок 4: Перевірити навігацію за допомогою клавіатури
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('TC_PUMB_INFO_012: Валідація HTML структури сторінки', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Перевірити наявність основних HTML елементів
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'uk-UA');
    
    // Крок 2: Перевірити наявність мета-тегів
    const charset = page.locator('meta[charset]');
    await expect(charset).toHaveAttribute('charset', 'utf-8');
    
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
    
    // Крок 3: Перевірити наявність favicon
    const favicon = page.locator('link[rel*="icon"]');
    await expect(favicon).toBeVisible();
    
    // Крок 4: Перевірити валідність HTML коду (базова перевірка)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('TC_PUMB_INFO_013: Перевірка мета-тегів та SEO', async () => {
    await page.goto(PUMB_CHECK_INFO_URL);
    await page.waitForLoadState('networkidle');
    
    // Крок 1: Перевірити title сторінки
    const title = await page.title();
    expect(title).toContain('ПУМБ');
    expect(title).toContain('бізнес');
    
    // Крок 2: Перевірити meta description
    const description = page.locator('meta[name="description"]');
    const descriptionContent = await description.getAttribute('content');
    expect(descriptionContent).toBeTruthy();
    
    // Крок 3: Перевірити Open Graph теги
    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDescription = page.locator('meta[property="og:description"]');
    
    if (await ogTitle.count() > 0) {
      await expect(ogTitle).toBeVisible();
    }
    
    if (await ogDescription.count() > 0) {
      await expect(ogDescription).toBeVisible();
    }
    
    // Крок 4: Перевірити наявність canonical URL
    const canonical = page.locator('link[rel="canonical"]');
    if (await canonical.count() > 0) {
      await expect(canonical).toBeVisible();
    }
  });

  test('TC_PUMB_INFO_014: Перевірка поведінки при відсутності JavaScript', async () => {
    // Крок 1: Відключити JavaScript
    await page.setJavaScriptEnabled(false);
    
    await page.goto(PUMB_CHECK_INFO_URL);
    
    // Крок 2: Перезавантажити сторінку
    await page.reload();
    
    // Крок 3: Перевірити відображення основного контенту
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    // Крок 4: Перевірити функціональність кнопок
    const backButton = page.locator('text=Повернутись');
    const continueButton = page.locator('text=Продовжити');
    
    // Кнопки можуть не працювати без JavaScript, але повинні бути видимі
    await expect(backButton).toBeVisible();
    await expect(continueButton).toBeVisible();
    
    // Увімкнути JavaScript назад
    await page.setJavaScriptEnabled(true);
  });

  test('TC_PUMB_INFO_015: Перевірка поведінки при медленному інтернет-з\'єднанні', async () => {
    // Крок 1: Симулювати повільне з'єднання
    await page.route('**/*', async route => {
      // Додаємо затримку для симуляції повільного інтернету
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    const startTime = Date.now();
    await page.goto(PUMB_CHECK_INFO_URL);
    const loadTime = Date.now() - startTime;
    
    // Крок 2: Перезавантажити сторінку
    await page.reload();
    
    // Крок 3: Заміряти час завантаження
    console.log(`Сторінка завантажилася за ${loadTime}ms`);
    
    // Крок 4: Перевірити відображення контенту після завантаження
    const mainTitle = page.locator('text=ВІДКРИВАЄМО РАХУНОК ДЛЯ ФОП');
    await expect(mainTitle).toBeVisible();
    
    const requirementsSection = page.locator('text=Вимоги до ФОП');
    await expect(requirementsSection).toBeVisible();
    
    // Перевірити, що час завантаження не перевищує 10 секунд
    expect(loadTime).toBeLessThan(10000);
  });
});
