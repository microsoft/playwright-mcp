import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Запуск глобального setup для тестів ПУМБ...');
  
  // Можна додати логіку для підготовки тестового середовища
  // Наприклад, перевірка доступності сайту, створення тестових даних тощо
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Перевіряємо доступність сайту перед запуском тестів
    console.log('🔍 Перевірка доступності сайту ПУМБ...');
    await page.goto('https://www.digital.pumb.ua/registration/fop/choose', { 
      timeout: 30000,
      waitUntil: 'networkidle'
    });
    
    const title = await page.title();
    console.log(`✅ Сайт доступний. Заголовок: ${title}`);
    
  } catch (error) {
    console.error('❌ Помилка при перевірці доступності сайту:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ Глобальний setup завершено успішно');
}

export default globalSetup;







