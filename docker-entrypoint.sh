#!/bin/sh
# Entrypoint скрипт для замены переменных окружения в JS файлах

# Заменяем SUPABASE_URL если задан
if [ -n "$SUPABASE_URL" ]; then
    echo "Заменяю SUPABASE_URL на: $SUPABASE_URL"
    sed -i "s|'https://aeewpulwnamwavtejlzq.supabase.co'|'$SUPABASE_URL'|g" /usr/share/nginx/html/js/supabase-config.js
fi

# Заменяем SUPABASE_ANON_KEY если задан
if [ -n "$SUPABASE_ANON_KEY" ]; then
    echo "Заменяю SUPABASE_ANON_KEY на новый ключ"
    # Используем более надежный метод: находим строку с ключом и заменяем значение
    # Ищем строку вида: : 'eyJ...' и заменяем на новый ключ
    # Экранируем специальные символы в ключе для sed
    ESCAPED_KEY=$(echo "$SUPABASE_ANON_KEY" | sed 's/[[\.*^$()+?{|]/\\&/g')
    # Заменяем любой JWT токен (начинается с eyJ) между одинарными кавычками
    sed -i "s|: 'eyJ[^']*'|: '$ESCAPED_KEY'|g" /usr/share/nginx/html/js/supabase-config.js
    echo "Ключ заменен. Проверяю результат..."
    # Проверяем, что замена прошла успешно
    if grep -q "$SUPABASE_ANON_KEY" /usr/share/nginx/html/js/supabase-config.js; then
        echo "✓ Ключ успешно заменен в файле"
    else
        echo "⚠ ВНИМАНИЕ: Ключ не найден в файле после замены!"
    fi
fi

# Заменяем R2_PUBLIC_URL если задан
if [ -n "$R2_PUBLIC_URL" ]; then
    echo "Заменяю R2_PUBLIC_URL на: $R2_PUBLIC_URL"
    sed -i "s|'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev'|'$R2_PUBLIC_URL'|g" /usr/share/nginx/html/js/r2-config.js
fi

echo "Конфигурация обновлена. Запускаю nginx..."

# Запускаем nginx
exec nginx -g "daemon off;"

