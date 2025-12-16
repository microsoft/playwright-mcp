# Керівництво по виконанню автотестів ПУМБ

## Встановлення залежностей

```bash
# Перейти в папку з тестами
cd C:\playwright-mcp\tests\pumb-registration-tests

# Встановити залежності
npm install

# Встановити браузери для Playwright
npm run test:install
```

## Запуск тестів

### Базові команди

```bash
# Запустити всі тести
npm run test

# Запустити тести з відображенням браузера
npm run test:headed

# Запустити тести в режимі налагодження
npm run test:debug

# Запустити тести з UI інтерфейсом
npm run test:ui
```

### Запуск на конкретних браузерах

```bash
# Тільки Chrome
npm run test:chromium

# Тільки Firefox
npm run test:firefox

# Тільки Safari
npm run test:webkit

# Мобільні браузери
npm run test:mobile

# Всі браузери
npm run test:all-browsers
```

## Перегляд результатів

```bash
# Відкрити HTML звіт
npm run test:report
```

## Структура тестів

### Покриті тест-кейси:

1. **TC_PUMB_001** - Відображення головної сторінки реєстрації ФОП
2. **TC_PUMB_002** - Вибір способу "Без участі менеджера"
3. **TC_PUMB_003** - Вибір способу "За участю менеджера"
4. **TC_PUMB_007** - Перевірка поведінки при відсутності JavaScript
5. **TC_PUMB_008** - Перевірка поведінки при медленному інтернет-з'єднанні
6. **TC_PUMB_009** - Перевірка поведінки при відключенні cookies
7. **TC_PUMB_010** - Адаптивність сторінки на різних розмірах екрану
8. **TC_PUMB_011** - Перевірка відображення промо-банера
9. **TC_PUMB_012** - Перевірка відображення контактної інформації
10. **TC_PUMB_013** - Перевірка доступності (accessibility)
11. **TC_PUMB_014** - Валідація HTML структури сторінки
12. **TC_PUMB_015** - Перевірка мета-тегів та SEO

## Налаштування

### Конфігурація Playwright

Файл `playwright.config.ts` містить налаштування для:
- Паралельного виконання тестів
- Ретріїв при падінні
- Знімків екрану при помилках
- Запису відео при падінні
- Трасування для налагодження

### Глобальні налаштування

- `global-setup.ts` - перевірка доступності сайту перед тестами
- `global-teardown.ts` - очищення після тестів

## CI/CD Integration

### GitHub Actions

```yaml
name: PUMB Tests
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
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npm run test
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
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
                sh 'npx playwright install --with-deps'
            }
        }
        stage('Run Tests') {
            steps {
                sh 'npm run test'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'playwright-report',
                        reportFiles: 'index.html',
                        reportName: 'Playwright Report'
                    ])
                }
            }
        }
    }
}
```

## Налагодження

### Локальне налагодження

```bash
# Запуск з відображенням браузера
npm run test:headed

# Запуск в режимі налагодження
npm run test:debug

# Запуск конкретного тесту
npx playwright test TC_PUMB_001
```

### Перегляд трасування

```bash
# Після падіння тесту
npx playwright show-trace trace.zip
```

## Моніторинг та звітність

### Метрики

- Час виконання тестів
- Відсоток успішності
- Кількість падіння
- Покриття функціоналу

### Звіти

- HTML звіт з скріншотами
- JSON звіт для інтеграції
- JUnit XML для CI/CD

## Підтримка та розвиток

### Додавання нових тестів

1. Створити новий тест-кейс у форматі `TC_PUMB_XXX_Description.md`
2. Додати відповідний тест у `pumb-registration.spec.ts`
3. Оновити документацію

### Оновлення селекторів

При зміні UI необхідно оновити селектори в тестах:
- Використовувати стабільні селектори (data-testid)
- Додавати fallback селектори
- Тестувати на різних браузерах

### Масштабування

Для додавання нових сторінок:
1. Створити новий spec файл
2. Додати в конфігурацію
3. Налаштувати глобальні хуки







