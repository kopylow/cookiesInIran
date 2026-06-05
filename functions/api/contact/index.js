import { json, jsonError, getClientIp, readJson } from "../_lib/http.js";
import { validateName, validateBody, validateEmail, isHoneypotTriggered } from "../_lib/validation.js";
import { hashIp } from "../_lib/hash.js";
import { verifyTurnstile } from "../_lib/turnstile.js";
import { rateLimitAll, isBypassed } from "../_lib/ratelimit.js";
import { sendContactEmail } from "../_lib/email.js";

const PHONE_MAX = 40;
const PHONE_RE = /^[0-9+()\/\s.\-]+$/;
const ALLOWED_LANGS = ["de", "en", "ru"];

// Lenient phone check: optional field, so we only guard length and a permissive
// character set (digits + the usual separators). Returns the trimmed value, or
// null when empty; `false` signals "present but invalid".
function validatePhone(phone) {
  if (typeof phone !== "string") return null;
  const t = phone.trim();
  if (!t) return null;
  if (t.length > PHONE_MAX || !PHONE_RE.test(t)) return false;
  return t;
}

export async function onRequestPost({ request, env }) {
  const payload = await readJson(request);
  if (!payload) return jsonError("invalid_payload", 400);

  // Honeypot — return success but drop silently so bots get no signal.
  if (isHoneypotTriggered(payload)) return json({ ok: true });

  const name = validateName(payload.name);
  if (!name) return jsonError("invalid_name", 400, "invalid_name");
  const message = validateBody(payload.message);
  if (!message) return jsonError("invalid_message", 400, "invalid_message");

  const emailRaw = payload.email;
  const email = emailRaw ? validateEmail(emailRaw) : null;
  if (emailRaw && !email) return jsonError("invalid_email", 400, "invalid_email");

  const phone = validatePhone(payload.phone);
  if (phone === false) return jsonError("invalid_phone", 400, "invalid_phone");

  const lang = ALLOWED_LANGS.includes(payload.lang) ? payload.lang : "en";

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env);

  // Per-IP rate limit: 3/hour blocks bursts, 10/day caps a determined flooder.
  if (!isBypassed(env, ip)) {
    const rl = await rateLimitAll(env.KV_RATELIMIT, `contact:ip:${ipHash}`, [
      { label: "h", limit: 3,  windowSec: 3600  },
      { label: "d", limit: 10, windowSec: 86400 },
    ]);
    if (!rl.allowed) {
      return jsonError("rate_limited", 429, "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    }
  }

  // Turnstile (skipped if no TURNSTILE_SECRET configured).
  const ts = await verifyTurnstile(env, payload.turnstileToken, ip);
  if (!ts.ok) return jsonError("captcha_failed", 400, "captcha_failed");

  try {
    await sendContactEmail(env, {
      to: env.CONTACT_TO,
      fromName: name,
      fromEmail: email || "",
      phone: phone || "",
      message,
      lang,
    });
  } catch (e) {
    console.error("contact send failed:", e);
    return jsonError("send_failed", 502, "send_failed");
  }

  return json({ ok: true });
}
