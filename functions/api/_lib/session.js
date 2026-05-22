import { sha256Hex, randomHex } from "./hash.js";

const COOKIE_NAME = "cii_sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function createSession(env, identityId) {
  const token = randomHex(32);
  const hash = await sha256Hex(token);
  await env.KV_SESSIONS.put(`session:${hash}`, identityId, { expirationTtl: ONE_YEAR });
  return token;
}

export async function lookupSession(env, request) {
  const token = readCookie(request);
  if (!token) return null;
  const hash = await sha256Hex(token);
  return env.KV_SESSIONS.get(`session:${hash}`);
}

export async function destroySession(env, request) {
  const token = readCookie(request);
  if (!token) return;
  const hash = await sha256Hex(token);
  await env.KV_SESSIONS.delete(`session:${hash}`);
}

export function buildSessionCookie(token, { secure = true } = {}) {
  const sec = secure ? "Secure; " : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${sec}SameSite=Lax; Max-Age=${ONE_YEAR}`;
}

export function clearSessionCookie({ secure = true } = {}) {
  const sec = secure ? "Secure; " : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; ${sec}SameSite=Lax; Max-Age=0`;
}

function readCookie(request) {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)cii_sid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
