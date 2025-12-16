@echo off
echo ========================================
echo  ПУМБ Реєстрація ФОП - Chrome Тести
echo ========================================
echo.

echo Перевірка наявності Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js не встановлено! Будь ласка, встановіть Node.js з https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js знайдено
echo.

echo Перевірка наявності npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm не знайдено!
    pause
    exit /b 1
)

echo ✅ npm знайдено
echo.

echo Встановлення залежностей...
call npm install
if errorlevel 1 (
    echo ❌ Помилка при встановленні залежностей!
    pause
    exit /b 1
)

echo ✅ Залежності встановлено
echo.

echo Встановлення браузерів Playwright...
call npx playwright install chromium
if errorlevel 1 (
    echo ❌ Помилка при встановленні браузерів!
    pause
    exit /b 1
)

echo ✅ Браузери встановлено
echo.

echo ========================================
echo Виберіть варіант запуску Chrome тестів:
echo ========================================
echo 1. Запустити всі Chrome тести
echo 2. Запустити Chrome тести з відображенням браузера
echo 3. Запустити Chrome тести в режимі налагодження
echo 4. Запустити Chrome тести з UI інтерфейсом
echo 5. Запустити тільки тести сторінки ознайомлення з інформацією
echo 6. Запустити тести ознайомлення з відображенням браузера
echo 7. Відкрити звіт Chrome тестів
echo 8. Запустити тести з детальним логуванням
echo 0. Вихід
echo ========================================

set /p choice="Введіть номер варіанту (0-8): "

if "%choice%"=="1" (
    echo Запуск всіх Chrome тестів...
    call npm run test:chrome
) else if "%choice%"=="2" (
    echo Запуск Chrome тестів з відображенням браузера...
    call npm run test:chrome:headed
) else if "%choice%"=="3" (
    echo Запуск Chrome тестів в режимі налагодження...
    call npm run test:chrome:debug
) else if "%choice%"=="4" (
    echo Запуск Chrome тестів з UI інтерфейсом...
    call npm run test:chrome:ui
) else if "%choice%"=="5" (
    echo Запуск тестів сторінки ознайомлення з інформацією...
    call npm run test:check-info
) else if "%choice%"=="6" (
    echo Запуск тестів ознайомлення з відображенням браузера...
    call npm run test:check-info:headed
) else if "%choice%"=="7" (
    echo Відкриття звіту Chrome тестів...
    call npm run test:chrome:report
) else if "%choice%"=="8" (
    echo Запуск тестів з детальним логуванням...
    call npx playwright test --config=playwright-chrome.config.ts --reporter=list,html
) else if "%choice%"=="0" (
    echo До побачення!
    exit /b 0
) else (
    echo ❌ Невірний вибір!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Chrome тести завершено!
echo ========================================
echo.
echo Результати збережено в папці: chrome-test-results/
echo HTML звіт: chrome-test-results/html-report/index.html
echo.
pause







