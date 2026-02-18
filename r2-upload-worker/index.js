/**
 * R2 Upload Worker - PUT /upload?name=<key>, body = file. Writes to bucket abu-ic.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (request.method !== "PUT" || !url.pathname.endsWith("/upload")) {
      return json({ error: "Use PUT /upload?name=<key>" }, 400);
    }
    const key = url.searchParams.get("name");
    if (!key || key.trim() === "") {
      return json({ error: "Query name (object key) is required" }, 400);
    }
    const contentType = request.headers.get("Content-Type") || "application/octet-stream";
    try {
      await env.BUCKET.put(key.trim(), request.body, {
        httpMetadata: { contentType },
      });
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
    // Поддерживаем оба имени переменной (в Dashboard у тебя PUBLIC_BASE_URL)
    const publicBase = env.PUBLIC_BASE_URL || env.R2_PUBLIC_URL || "";
    if (!publicBase) {
      return json({ error: "PUBLIC_BASE_URL or R2_PUBLIC_URL env variable is not set" }, 500);
    }
    const fileUrl = publicBase.replace(/\/$/, "") + "/" + key;
    return json({ ok: true, url: fileUrl, key: key.trim() });
  },
};
