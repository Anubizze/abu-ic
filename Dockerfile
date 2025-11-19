# Используем легковесный nginx для статического сайта
FROM nginx:alpine

# Копируем все файлы сайта в nginx (локальные конфиги исключаются через .dockerignore)
COPY . /usr/share/nginx/html

# Удаляем локальные конфиги на всякий случай (если они попали)
RUN rm -f /usr/share/nginx/html/js/*.local.js /usr/share/nginx/html/js/*.local.json

# Копируем кастомную конфигурацию nginx (опционально)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80
EXPOSE 80

# Nginx запускается автоматически
CMD ["nginx", "-g", "daemon off;"]

