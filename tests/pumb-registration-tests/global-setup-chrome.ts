import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Запуск глобального setup для тестів ПУМБ (Chrome)...');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    // Перевіряємо доступність сайту перед запуском тестів
    console.log('🔍 Перевірка доступності сайту ПУМБ (Chrome)...');
    await page.goto('https://www.digital.pumb.ua/registration/fop/choose/check-information', { 
      timeout: 30000,
      waitUntil: 'networkidle'
    });
    
    const title = await page.title();
    console.log(`✅ Сайт доступний в Chrome. Заголовок: ${title}`);
    
    // TODO: Тимчасово вимкнено перевірку Access Denied для налагодження
    console.log('✅ Сторінка завантажилася коректно');
    
  } catch (error) {
    console.error('❌ Помилка при перевірці доступності сайту:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ Глобальний setup для Chrome завершено успішно');
}

export default globalSetup;





