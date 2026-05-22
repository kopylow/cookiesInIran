export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function jsonError(message, status = 400, code = "error", extraHeaders = {}) {
  return json({ ok: false, error: code, message }, status, extraHeaders);
}

export function methodNotAllowed(allowed) {
  return new Response(null, { status: 405, headers: { allow: allowed.join(", ") } });
}

export function getClientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
}

export function isHttps(request) {
  const u = new URL(request.url);
  return u.protocol === "https:";
}

export async function readJson(request) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try { return await request.json(); } catch { return null; }
}
