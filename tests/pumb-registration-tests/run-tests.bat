@echo off
echo ========================================
echo    ПУМБ Реєстрація ФОП - Автотести
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
call npx playwright install
if errorlevel 1 (
    echo ❌ Помилка при встановленні браузерів!
    pause
    exit /b 1
)

echo ✅ Браузери встановлено
echo.

echo ========================================
echo Виберіть варіант запуску тестів:
echo ========================================
echo 1. Запустити всі тести
echo 2. Запустити тести з відображенням браузера
echo 3. Запустити тести в режимі налагодження
echo 4. Запустити тести з UI інтерфейсом
echo 5. Запустити тільки Chrome
echo 6. Запустити тільки Firefox
echo 7. Запустити тільки Safari
echo 8. Запустити мобільні тести
echo 9. Відкрити звіт
echo 0. Вихід
echo ========================================

set /p choice="Введіть номер варіанту (0-9): "

if "%choice%"=="1" (
    echo Запуск всіх тестів...
    call npm run test
) else if "%choice%"=="2" (
    echo Запуск тестів з відображенням браузера...
    call npm run test:headed
) else if "%choice%"=="3" (
    echo Запуск тестів в режимі налагодження...
    call npm run test:debug
) else if "%choice%"=="4" (
    echo Запуск тестів з UI інтерфейсом...
    call npm run test:ui
) else if "%choice%"=="5" (
    echo Запуск тестів тільки в Chrome...
    call npm run test:chromium
) else if "%choice%"=="6" (
    echo Запуск тестів тільки в Firefox...
    call npm run test:firefox
) else if "%choice%"=="7" (
    echo Запуск тестів тільки в Safari...
    call npm run test:webkit
) else if "%choice%"=="8" (
    echo Запуск мобільних тестів...
    call npm run test:mobile
) else if "%choice%"=="9" (
    echo Відкриття звіту...
    call npm run test:report
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
echo Тести завершено!
echo ========================================
pause







