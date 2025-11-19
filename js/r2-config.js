// js/r2-config.js
// Production конфигурация Cloudflare R2
// Для локальной разработки эти значения переопределяются через r2-config.local.js
window.R2_CONFIG = Object.assign(
  {
    ACCOUNT_ID: '629c800a0a89cb62795d6e16511cae7e',
    BUCKET: 'abu-documents',
    PUBLIC_URL: 'https://pub-a797bdf4261e4c448d835644b30caa41.r2.dev',
    WORKER_URL: 'https://r2-uploader.kairatovadil7.workers.dev'
  },
  window.R2_CONFIG || {}
);