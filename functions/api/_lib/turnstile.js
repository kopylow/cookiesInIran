const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) {
    // No secret configured — treat as bypassed (dev mode).
    return { ok: true, dev: true };
  }
  if (!token || typeof token !== "string") return { ok: false, reason: "missing" };
  const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) params.set("remoteip", ip);
  const r = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!r.ok) return { ok: false, reason: "siteverify-error" };
  const data = await r.json();
  return { ok: !!data.success, reason: data.success ? null : (data["error-codes"]?.[0] || "unknown") };
}
