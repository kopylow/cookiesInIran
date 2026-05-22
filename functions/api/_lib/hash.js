const enc = new TextEncoder();

export async function sha256Hex(input) {
  const data = typeof input === "string" ? enc.encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashIp(ip, env) {
  return sha256Hex(`${ip}|${env.IP_HASH_SALT_CURRENT}`);
}

export async function hashIpPrevious(ip, env) {
  if (!env.IP_HASH_SALT_PREVIOUS) return null;
  return sha256Hex(`${ip}|${env.IP_HASH_SALT_PREVIOUS}`);
}

export async function hashEmail(email, env) {
  const normalized = email.trim().toLowerCase();
  return sha256Hex(`${normalized}|${env.EMAIL_HASH_SALT}`);
}

export function randomHex(byteLength) {
  const buf = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...buf].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function randomNumericCode(digits = 6) {
  const max = 10 ** digits;
  const buf = crypto.getRandomValues(new Uint32Array(1));
  return String(buf[0] % max).padStart(digits, "0");
}
