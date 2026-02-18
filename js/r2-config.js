// js/r2-config.js
// Production конфигурация Cloudflare R2
// Для локальной разработки эти значения переопределяются через r2-config.local.js

// Базовые настройки по умолчанию
// Worker загрузки: папка r2-upload-worker, в wrangler.toml указан bucket_name = "abu-ic"
const defaultConfig = {
  ACCOUNT_ID: '629c800a0a89cb62795d6e16511cae7e',
  BUCKET: 'abu-ic',
  // Public URL для документов и изображений (bucket abu-ic, включи Public Access в R2)
  PUBLIC_URL: 'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev',
  IMAGES_PUBLIC_URL: 'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev',
  // По умолчанию используем прокси через nginx для решения проблемы CORS
  // Это работает с любым origin (localhost:8080, localhost:3000, production domain)
  WORKER_URL: '/api/r2-upload'
};

// Сохраняем существующую конфигурацию (если есть локальные переопределения)
const existingConfig = window.R2_CONFIG || {};

// Объединяем конфигурации
window.R2_CONFIG = Object.assign({}, defaultConfig, existingConfig);

// Логирование для отладки отключено

// ВАЖНО: По умолчанию всегда используем прокси через nginx для решения CORS
// Только если явно указан прямой URL к worker (начинается с https://), используем его
// Но для работы через Docker и у других пользователей лучше использовать прокси
if (!existingConfig.WORKER_URL || existingConfig.WORKER_URL === 'https://r2-uploader.kairatovadil7.workers.dev') {
  // Используем прокси по умолчанию
  window.R2_CONFIG.WORKER_URL = '/api/r2-upload';
} else if (existingConfig.WORKER_URL && existingConfig.WORKER_URL.startsWith('/')) {
  // Если уже установлен относительный путь, оставляем его
  window.R2_CONFIG.WORKER_URL = existingConfig.WORKER_URL;
}
// Если установлен другой полный URL (не стандартный worker), используем его как есть