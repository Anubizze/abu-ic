# R2 Upload Worker

Worker для загрузки файлов в Cloudflare R2. Бакет задаётся в **wrangler.toml**:

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "abu-ic"
```

Сейчас используется бакет **abu-ic**.

## Деплой

1. Установи [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm i -g wrangler`
2. Войди в Cloudflare: `wrangler login`
3. Из папки `r2-upload-worker` выполни: `wrangler deploy`

После деплоя Worker будет писать файлы в бакет **abu-ic**. Если раньше был задеплоен другой конфиг (например, с бакетом abu-documents), после этого деплоя загрузки пойдут в abu-ic.

## Переменная R2_PUBLIC_URL (опционально)

В Dashboard: Workers & Pages → r2-uploader → Settings → Variables — можно задать **R2_PUBLIC_URL** (публичный URL бакета abu-ic), чтобы Worker возвращал в ответе поле `url`. Если не задано, фронт сам соберёт URL из `r2-config.js` (PUBLIC_URL + key).
