// Конфигурация Supabase
// Версия: 2025-01-08 (обновлен ключ)
// Используем переменные окружения или значения по умолчанию
const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL 
    : 'https://aeewpulwnamwavtejlzq.supabase.co';
    
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZXdwdWx3bmFtd2F2dGVqbHpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNjIxMDcsImV4cCI6MjA3NzczODEwN30.f1eYj60USjd9qtY-USo81LO2BrO-Zl5P4Xs2zboJvzs';
    // ⚠️ ВАЖНО: Если вы видите ошибку "JWT expired" или "401 Unauthorized":
    // 1. Откройте Supabase Dashboard: https://supabase.com/dashboard
    // 2. Выберите ваш проект
    // 3. Перейдите в Settings → API
    // 4. Скопируйте актуальный "anon" или "publishable" ключ
    // 5. Замените значение выше на новый ключ
    // 6. Сохраните файл и обновите страницу (Ctrl+F5)

// Проверка ключа
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim() === '') {
    console.error('[supabase-config] ⚠️ ОШИБКА: SUPABASE_ANON_KEY не задан или пустой!');
    console.error('[supabase-config] Установите правильный ключ в файле js/supabase-config.js');
} else if (SUPABASE_ANON_KEY.length < 20) {
    console.warn('[supabase-config] ⚠️ ПРЕДУПРЕЖДЕНИЕ: SUPABASE_ANON_KEY слишком короткий. Возможно, ключ неверный.');
}
    
const STORAGE_BUCKET = 'news-images'; // Bucket для изображений новостей
const DOCUMENTS_BUCKET = 'documents'; // Bucket для документов

// Инициализация Supabase клиента
// Библиотека @supabase/supabase-js через jsDelivr CDN экспортируется через window.supabase
// Используем window.supabase для глобального доступа, чтобы избежать конфликтов
// Не объявляем локальную переменную supabase, чтобы избежать ошибки "already declared"
var supabase; // Используем var для избежания конфликтов при повторной загрузке скрипта

(function initializeSupabase() {
    // Функция инициализации, которая пытается найти библиотеку
    function init() {
        // Через jsDelivr CDN (UMD версия) библиотека экспортируется через window.supabase
        // Также поддерживаем другие варианты для обратной совместимости
        
        // Проверяем, есть ли библиотека Supabase (может быть window.supabase или window.supabaseLib)
        const supabaseLib = window.supabase || window.supabaseLib;
        
        if (typeof supabaseLib !== 'undefined' && typeof supabaseLib.createClient === 'function') {
            // Основной способ для jsDelivr CDN (UMD версия)
            try {
                // Проверяем, что ключ не пустой перед созданием клиента
                if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim() === '') {
                    console.error('[supabase-config] ⚠️ ОШИБКА: Нельзя создать Supabase клиент без ключа!');
                    return false;
                }
                
                // Создаем клиент и сохраняем в window для глобального доступа
                const client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                window.supabase = client;
                supabase = client; // Для обратной совместимости
                
                // Тестовый запрос для проверки ключа
                supabase.from('document_usages').select('id').limit(1).then(({ error }) => {
                    if (error) {
                        if (error.code === 'PGRST303' || error.message?.includes('JWT expired')) {
                            console.error('[supabase-config] ⚠️⚠️⚠️ КРИТИЧЕСКАЯ ОШИБКА: JWT токен истек!');
                            console.error('[supabase-config] Ключ Supabase истек или неверный. Обновите SUPABASE_ANON_KEY в файле js/supabase-config.js');
                            console.error('[supabase-config] Инструкция: https://supabase.com/dashboard → Settings → API → скопируйте anon/publishable ключ');
                        } else if (error.code === 'PGRST301' || error.status === 401) {
                            console.error('[supabase-config] ⚠️⚠️⚠️ КРИТИЧЕСКАЯ ОШИБКА: Неавторизованный доступ!');
                            console.error('[supabase-config] Проверьте SUPABASE_ANON_KEY в файле js/supabase-config.js');
                        }
                    }
                }).catch(err => {
                    console.error('[supabase-config] Ошибка тестового запроса:', err);
                });
                
                return true;
            } catch (e) {
                console.error('[supabase-config] Ошибка создания клиента Supabase:', e);
                console.error('[supabase-config] Проверьте, что SUPABASE_URL и SUPABASE_ANON_KEY корректны');
            }
        } else if (typeof supabaseLib !== 'undefined') {
            // Альтернативный способ (если библиотека экспортируется как supabaseLib)
            try {
                supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✓ Supabase инициализирован через supabaseLib');
                return true;
            } catch (e) {
                console.error('Ошибка создания клиента Supabase:', e);
            }
        } else if (typeof window.supabaseLib !== 'undefined') {
            // Еще один вариант
            try {
                supabase = window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✓ Supabase инициализирован через window.supabaseLib');
                return true;
            } catch (e) {
                console.error('Ошибка создания клиента Supabase:', e);
            }
        }
        return false;
    }

    // Пробуем инициализировать сразу
    if (init()) {
        return;
    }

    // Если не получилось, ждём загрузки библиотеки
    let attempts = 0;
    const maxAttempts = 30; // 1.5 секунды максимум
    
    const checkInterval = setInterval(function() {
        attempts++;
        
        if (init()) {
            clearInterval(checkInterval);
        } else if (attempts >= maxAttempts) {
            console.error('✗ Не удалось инициализировать Supabase. Проверьте подключение скрипта библиотеки.');
            clearInterval(checkInterval);
        }
    }, 50);
})();

