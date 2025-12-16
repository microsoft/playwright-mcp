import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Запуск глобального teardown для тестів ПУМБ (Chrome)...');
  
  // Можна додати логіку для очищення після тестів
  // Наприклад, видалення тестових даних, закриття з'єднань тощо
  
  console.log('✅ Глобальний teardown для Chrome завершено успішно');
}

export default globalTeardown;







