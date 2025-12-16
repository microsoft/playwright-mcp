# Chrome Тести для ПУМБ - Сторінка Ознайомлення з Інформацією

## Опис
Автотести на Playwright для тестування сторінки "Ознайомтесь з інформацією" ПУМБ Бізнес, оптимізовані для Google Chrome браузера.

## Покриті тест-кейси (15 штук)

### Функціональні тести (9 кейсів)
1. **TC_PUMB_INFO_001** - Відображення сторінки ознайомлення з інформацією
2. **TC_PUMB_INFO_002** - Перевірка відображення вимог до ФОП
3. **TC_PUMB_INFO_003** - Перевірка відображення тарифного пакету
4. **TC_PUMB_INFO_004** - Перевірка функціональності кнопки "Повернутись"
5. **TC_PUMB_INFO_005** - Перевірка функціональності кнопки "Продовжити"
6. **TC_PUMB_INFO_006** - Перевірка посилання на деталі тарифного пакету
7. **TC_PUMB_INFO_007** - Перевірка посилань на альтернативні способи реєстрації
8. **TC_PUMB_INFO_014** - Перевірка поведінки при відсутності JavaScript
9. **TC_PUMB_INFO_015** - Перевірка поведінки при медленному інтернет-з'єднанні

### UI тести (4 кейси)
10. **TC_PUMB_INFO_008** - Перевірка відображення промо-банера
11. **TC_PUMB_INFO_009** - Перевірка відображення контактної інформації
12. **TC_PUMB_INFO_010** - Адаптивність сторінки на різних розмірах екрану
13. **TC_PUMB_INFO_011** - Перевірка доступності (accessibility)

### Валідаційні тести (2 кейси)
14. **TC_PUMB_INFO_012** - Валідація HTML структури сторінки
15. **TC_PUMB_INFO_013** - Перевірка мета-тегів та SEO

## Файли проекту

### Основні файли тестів
- **pumb-check-information-chrome.spec.ts** - Основний файл з 15 автотестами
- **playwright-chrome.config.ts** - Конфігурація для Chrome
- **global-setup-chrome.ts** - Глобальна підготовка тестів
- **global-teardown-chrome.ts** - Глобальне очищення після тестів

### Допоміжні файли
- **run-chrome-tests.bat** - Зручний запуск тестів для Windows
- **PUMB_Check_Information_TestRail_Import.csv** - Тест-кейси для імпорту в TestRail
- **TestRail_Import_Instructions.md** - Інструкції по імпорту

## Запуск тестів

### Швидкий запуск
```bash
# Запустити batch файл
run-chrome-tests.bat
```

### Ручний запуск через npm
```bash
# Встановити залежності
npm install

# Встановити браузери
npx playwright install chromium

# Запустити всі Chrome тести
npm run test:chrome

# Запустити з відображенням браузера
npm run test:chrome:headed

# Запустити тільки тести ознайомлення з інформацією
npm run test:check-info

# Запустити з UI інтерфейсом
npm run test:chrome:ui
```

### Прямий запуск через Playwright
```bash
# Запустити з конфігурацією Chrome
npx playwright test --config=playwright-chrome.config.ts

# Запустити конкретний файл
npx playwright test pumb-check-information-chrome.spec.ts --config=playwright-chrome.config.ts

# Запустити з відображенням браузера
npx playwright test --config=playwright-chrome.config.ts --headed
```

## Конфігурація Chrome

### Особливості налаштування
- **Браузер:** Google Chrome (системний)
- **Режим:** Headless/Headed (залежно від налаштувань)
- **Розмір вікна:** 1280x720
- **User-Agent:** Chrome 120.0.0.0
- **Додаткові аргументи:** Для обходу блокувань та оптимізації

### Аргументи Chrome
```javascript
args: [
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-plugins',
  '--disable-images',
  '--disable-javascript-harmony-shipping',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding'
]
```

## Результати тестування

### Директорії результатів
- **chrome-test-results/** - Основна папка з результатами
- **chrome-test-results/html-report/** - HTML звіт
- **chrome-test-results/results.json** - JSON звіт
- **chrome-test-results/results.xml** - JUnit XML звіт

### Типи звітів
- **HTML Report** - Інтерактивний звіт з скріншотами
- **JSON Report** - Структурований звіт для інтеграції
- **JUnit XML** - Для CI/CD систем
- **Console Output** - Детальне логування в консолі

## Налагодження

### Режими налагодження
```bash
# Режим налагодження
npm run test:chrome:debug

# UI режим
npm run test:chrome:ui

# Запуск з детальним логуванням
npx playwright test --config=playwright-chrome.config.ts --reporter=list,html
```

### Перегляд трасування
```bash
# Після падіння тесту
npx playwright show-trace trace.zip
```

### Скріншоти та відео
- Скріншоти зберігаються при падінні тестів
- Відео записується при падінні тестів
- Трасування збирається при повторі падіння

## CI/CD Інтеграція

### GitHub Actions
```yaml
name: PUMB Chrome Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps chromium
    - name: Run Chrome tests
      run: npm run test:chrome
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: chrome-test-results
        path: chrome-test-results/
        retention-days: 30
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                sh 'npx playwright install --with-deps chromium'
            }
        }
        stage('Run Chrome Tests') {
            steps {
                sh 'npm run test:chrome'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'chrome-test-results/html-report',
                        reportFiles: 'index.html',
                        reportName: 'Chrome Test Report'
                    ])
                }
            }
        }
    }
}
```

## Моніторинг та метрики

### Ключові метрики
- **Час виконання тестів:** ~45 хвилин
- **Відсоток успішності:** Ціль 95%+
- **Кількість падіння:** Моніторинг трендів
- **Покриття функціоналу:** 15/15 тест-кейсів

### Алерти
- Падіння критичних тестів (High Priority)
- Збільшення часу виконання
- Зниження відсотка успішності

## Підтримка та розвиток

### Оновлення тестів
1. При зміні UI оновити селектори
2. Додати нові тест-кейси при розширенні функціоналу
3. Оновити конфігурацію при зміні вимог

### Масштабування
- Додавання нових сторінок
- Розширення покриття браузерами
- Інтеграція з додатковими інструментами

### Контакти
- **QA Team** - для питань по тестах
- **DevOps Team** - для CI/CD налаштувань
- **Product Team** - для змін у функціоналі







