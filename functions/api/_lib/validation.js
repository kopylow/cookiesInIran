const NAME_MIN = 1;
const NAME_MAX = 60;
const BODY_MIN = 1;
const BODY_MAX = 2000;
const REASON_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function allowedLangs(env) {
  return (env.ALLOWED_LANGS || "de,en,ru,fa").split(",").map(s => s.trim()).filter(Boolean);
}

export function isLang(env, lang) {
  return typeof lang === "string" && allowedLangs(env).includes(lang);
}

export function parseThreadId(env, raw) {
  if (typeof raw !== "string") return null;
  const max = parseInt(env.MAX_CHAPTER_INDEX || "25", 10);
  const langs = allowedLangs(env);
  let m = raw.match(/^main:([a-z]{2})$/);
  if (m && langs.includes(m[1])) return { id: raw, kind: "main", lang: m[1] };
  m = raw.match(/^ch:(\d+):([a-z]{2})$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 0 && n <= max && langs.includes(m[2])) return { id: raw, kind: "ch", chapter: n, lang: m[2] };
  }
  return null;
}

export function validateName(name) {
  if (typeof name !== "string") return null;
  const t = name.replace(/\s+/g, " ").trim();
  if (t.length < NAME_MIN || t.length > NAME_MAX) return null;
  return t;
}

export function validateBody(body) {
  if (typeof body !== "string") return null;
  const t = body.replace(/\r\n/g, "\n").trim();
  if (t.length < BODY_MIN || t.length > BODY_MAX) return null;
  return t;
}

export function validateEmail(email) {
  if (typeof email !== "string") return null;
  const t = email.trim().toLowerCase();
  if (t.length > 254 || !EMAIL_RE.test(t)) return null;
  return t;
}

export function validateReason(reason) {
  if (reason == null) return null;
  if (typeof reason !== "string") return null;
  const t = reason.trim();
  if (t.length === 0) return null;
  if (t.length > REASON_MAX) return t.slice(0, REASON_MAX);
  return t;
}

export function validateCode(code) {
  if (typeof code !== "string") return null;
  const t = code.trim();
  if (!/^\d{6}$/.test(t)) return null;
  return t;
}

export function isHoneypotTriggered(payload) {
  return payload && typeof payload.website === "string" && payload.website.length > 0;
}
