// Конфигурация Supabase
// Используем переменные окружения или значения по умолчанию
const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL 
    : 'https://aeewpulwnamwavtejlzq.supabase.co';
    
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZXdwdWx3bmFtd2F2dGVqbHpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNjIxMDcsImV4cCI6MjA3NzczODEwN30.f1eYj60USjd9qtY-USo81LO2BrO-Zl5P4Xs2zboJvzs';
    
const STORAGE_BUCKET = 'news-images'; // Bucket для изображений новостей
const DOCUMENTS_BUCKET = 'documents'; // Bucket для документов

// Инициализация Supabase клиента
// Библиотека @supabase/supabase-js через CDN jsdelivr экспортирует через supabaseLib
let supabase;

(function initializeSupabase() {
    // Функция инициализации, которая пытается найти библиотеку
    function init() {
        // Через jsdelivr CDN библиотека обычно экспортируется как supabaseLib
        // Или может быть доступна через window.supabase
        
        if (typeof supabaseLib !== 'undefined') {
            // Стандартный способ для CDN jsdelivr
            try {
                supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✓ Supabase инициализирован через supabaseLib');
                return true;
            } catch (e) {
                console.error('Ошибка создания клиента Supabase:', e);
            }
        } else if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            // Альтернативный способ
            try {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('✓ Supabase инициализирован через window.supabase');
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

